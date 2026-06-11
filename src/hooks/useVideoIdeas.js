import { useState, useEffect, useCallback, useRef } from "react";
import {
  DEFAULT_CLIENTS,
  VIDEO_IDEAS_STORAGE_KEY,
} from "../constants";
import { loadClientResponses, clearClientResponses } from "../utils/clientShare";
import { stripDemoVideoIdeas, getRejectedVideoIdeaIds } from "../utils/demoVideoIdeas";
import { notifyMutation } from "../utils/undoHistory";
import { useReloadFromStorage } from "./useReloadFromStorage";
import { SUPABASE_ENABLED } from "../lib/supabaseClient";
import { useCollectionSync } from "../lib/useCollectionSync";
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from "../lib/syncInitialState";
import { readOrgScopedJson, writeOrgScopedJson } from "../lib/orgStorage";

function tombstoneIdeas(ids) {
  tombstoneSyncedDeletes("video_ideas", ids);
}

const getIdeaId = (idea) => idea.id;

function createIdea(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    client: DEFAULT_CLIENTS[0],
    title: "",
    referenceVideo: "",
    description: "",
    contentType: "Reel",
    status: "pending",
    clientComment: "",
    boardCardId: null,
    createdAt: Date.now(),
    reviewedAt: null,
    ...overrides,
  };
}

function loadIdeas() {
  try {
    const parsed = readOrgScopedJson(VIDEO_IDEAS_STORAGE_KEY, null);
    if (Array.isArray(parsed)) return stripDemoVideoIdeas(parsed);
  } catch {
    /* fall through */
  }
  return [];
}

export function useVideoIdeas() {
  const [ideas, setIdeas] = useState(() =>
    initialSyncCollectionState(loadIdeas, { table: "video_ideas", getId: getIdeaId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setIdeas(loadIdeas());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'video_ideas',
    items: ideas,
    setItems: setIdeas,
    getId: getIdeaId,
    loadLocal: loadIdeas,
    filterItems: stripDemoVideoIdeas,
    getRemotePurgeIds: getRejectedVideoIdeaIds,
  });

  // Debounce localStorage writes to avoid thrashing during rapid edits.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(VIDEO_IDEAS_STORAGE_KEY, ideas);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [ideas, syncLoaded]);

  const replaceIdeas = useCallback((next) => {
    setIdeas(stripDemoVideoIdeas(next));
  }, []);

  const addIdea = useCallback((ideaData) => {
    notifyMutation();
    const idea = createIdea(ideaData);
    setIdeas((prev) => [...prev, idea]);
  }, []);

  const updateIdea = useCallback((id, updates, options = {}) => {
    notifyMutation(options);
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return { ...i, ...updates, updatedAt: Date.now() };
      }),
    );
  }, []);

  const deleteIdea = useCallback((id) => {
    notifyMutation();
    tombstoneIdeas([id]);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const deleteIdeas = useCallback((ids) => {
    notifyMutation();
    tombstoneIdeas(ids);
    const idSet = new Set(ids);
    setIdeas((prev) => prev.filter((i) => !idSet.has(i.id)));
  }, []);

  const markApproved = useCallback((id, clientComment, boardCardId) => {
    notifyMutation();
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          status: "approved",
          clientComment,
          boardCardId,
          reviewedAt: Date.now(),
        };
      }),
    );
  }, []);

  const markDeclined = useCallback((id, clientComment) => {
    notifyMutation();
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          status: "declined",
          clientComment,
          reviewedAt: Date.now(),
        };
      }),
    );
  }, []);

  const ensureIdeaExists = useCallback((ideaSnapshot) => {
    notifyMutation();
    setIdeas((prev) => {
      if (prev.some((i) => i.id === ideaSnapshot.id)) return prev;
      return [...prev, createIdea(ideaSnapshot)];
    });
  }, []);

  const getPendingResponsesCount = useCallback(() => {
    return loadClientResponses().length;
  }, []);

  return {
    ideas,
    ideasSyncLoaded: syncLoaded,
    replaceIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    deleteIdeas,
    markApproved,
    markDeclined,
    ensureIdeaExists,
    getPendingResponsesCount,
  };
}

export function applyClientResponses(ideas, responses, { markApproved, markDeclined, ensureIdeaExists, createCardFromIdea, addIdea }) {
  let applied = 0;

  for (const response of responses) {
    const existing = ideas.find((i) => i.id === response.ideaId);
    const ideaData = existing || response.idea;

    if (!ideaData) continue;

    if (existing && existing.status !== "pending") continue;

    if (!existing && response.idea) {
      addIdea(response.idea);
    }

    if (response.action === "approved") {
      const boardCardId = createCardFromIdea({
        ...ideaData,
        clientComment: response.comment || "",
      });
      markApproved(response.ideaId, response.comment || "", boardCardId);
      applied += 1;
    } else if (response.action === "declined") {
      markDeclined(response.ideaId, response.comment || "");
      applied += 1;
    }
  }

  clearClientResponses();
  return applied;
}
