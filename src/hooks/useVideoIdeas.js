import { useState, useEffect, useCallback } from "react";
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
import { pushStaffSync, pushStaffSyncRecords } from "../lib/staffSyncApi";
import { markPendingRemoved } from "../lib/syncHelpers";
import { initialSyncCollectionState, shouldPersistSyncedState } from "../lib/syncInitialState";
import { getOrgId } from "../lib/orgSession";
import { readOrgScopedJson, writeOrgScopedJson } from "../lib/orgStorage";

function tombstoneIdeas(ids) {
  if (!SUPABASE_ENABLED || !ids?.length) return;
  markPendingRemoved(getOrgId(), "video_ideas", ids);
}

function persistIdeaUpsert(idea) {
  if (!SUPABASE_ENABLED || !idea) return;
  void pushStaffSyncRecords("video_ideas", [idea]);
}

function persistIdeaDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  void pushStaffSync({ table: "video_ideas", changed: [], removed: [id] });
}

function persistIdeaDeletes(ids) {
  if (!SUPABASE_ENABLED || !ids?.length) return;
  void pushStaffSync({ table: "video_ideas", changed: [], removed: ids });
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
  const [ideas, setIdeas] = useState(() => initialSyncCollectionState(loadIdeas));

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

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(VIDEO_IDEAS_STORAGE_KEY, ideas);
  }, [ideas, syncLoaded]);

  const replaceIdeas = useCallback((next) => {
    const normalized = stripDemoVideoIdeas(next);
    setIdeas(normalized);
    if (SUPABASE_ENABLED && normalized.length) {
      void pushStaffSyncRecords('video_ideas', normalized);
    }
  }, []);

  const addIdea = useCallback((ideaData) => {
    notifyMutation();
    const idea = createIdea(ideaData);
    setIdeas((prev) => [...prev, idea]);
    persistIdeaUpsert(idea);
  }, []);

  const updateIdea = useCallback((id, updates) => {
    notifyMutation();
    let persisted = null;
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        persisted = { ...i, ...updates, updatedAt: Date.now() };
        return persisted;
      }),
    );
    if (persisted) persistIdeaUpsert(persisted);
  }, []);

  const deleteIdea = useCallback((id) => {
    notifyMutation();
    tombstoneIdeas([id]);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    persistIdeaDelete(id);
  }, []);

  const deleteIdeas = useCallback((ids) => {
    notifyMutation();
    tombstoneIdeas(ids);
    const idSet = new Set(ids);
    setIdeas((prev) => prev.filter((i) => !idSet.has(i.id)));
    persistIdeaDeletes(ids);
  }, []);

  const markApproved = useCallback((id, clientComment, boardCardId) => {
    notifyMutation();
    let persisted = null;
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        persisted = {
          ...i,
          status: "approved",
          clientComment,
          boardCardId,
          reviewedAt: Date.now(),
        };
        return persisted;
      }),
    );
    if (persisted) persistIdeaUpsert(persisted);
  }, []);

  const markDeclined = useCallback((id, clientComment) => {
    notifyMutation();
    let persisted = null;
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        persisted = {
          ...i,
          status: "declined",
          clientComment,
          reviewedAt: Date.now(),
        };
        return persisted;
      }),
    );
    if (persisted) persistIdeaUpsert(persisted);
  }, []);

  const ensureIdeaExists = useCallback((ideaSnapshot) => {
    notifyMutation();
    let persisted = null;
    setIdeas((prev) => {
      if (prev.some((i) => i.id === ideaSnapshot.id)) return prev;
      persisted = createIdea(ideaSnapshot);
      return [...prev, persisted];
    });
    if (persisted) persistIdeaUpsert(persisted);
  }, []);

  const getPendingResponsesCount = useCallback(() => {
    return loadClientResponses().length;
  }, []);

  return {
    ideas,
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
