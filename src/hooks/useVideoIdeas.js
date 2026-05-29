import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_CLIENTS,
  VIDEO_IDEAS_STORAGE_KEY,
} from "../constants";
import { loadClientResponses, clearClientResponses } from "../utils/clientShare";
import { notifyMutation } from "../utils/undoHistory";
import { useReloadFromStorage } from "./useReloadFromStorage";
import { SUPABASE_ENABLED } from "../lib/supabaseClient";
import { useCollectionSync } from "../lib/useCollectionSync";

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

function getSampleIdeas() {
  return [
    createIdea({
      client: "Plume",
      title: "GRWM morning routine reel",
      referenceVideo: "https://www.instagram.com/reel/example1",
      description: "Soft aesthetic, focus on skincare products. Trending audio style.",
      contentType: "Reel",
    }),
    createIdea({
      client: "Plume",
      title: "Behind the scenes at the studio",
      referenceVideo: "https://www.instagram.com/reel/example2",
      description: "Raw, candid vibe. Show team culture.",
      contentType: "Reel",
    }),
    createIdea({
      client: "Arco Fit",
      title: "30-second workout challenge",
      referenceVideo: "https://www.tiktok.com/@example/video/123",
      description: "High energy, quick cuts. Coach demonstrating moves.",
      contentType: "Reel",
    }),
    createIdea({
      client: "The Locker Room",
      title: "Product unboxing carousel concept",
      referenceVideo: "https://www.instagram.com/reel/example3",
      description: "New jersey drop. Slide-by-slide breakdown.",
      contentType: "Carousel",
    }),
  ];
}

function loadIdeas() {
  try {
    const stored = localStorage.getItem(VIDEO_IDEAS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function useVideoIdeas() {
  const [ideas, setIdeas] = useState(loadIdeas);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setIdeas(loadIdeas());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useCollectionSync({
    table: 'video_ideas',
    items: ideas,
    setItems: setIdeas,
    getId: getIdeaId,
    loadLocal: loadIdeas,
  });

  useEffect(() => {
    if (SUPABASE_ENABLED) return;
    localStorage.setItem(VIDEO_IDEAS_STORAGE_KEY, JSON.stringify(ideas));
  }, [ideas]);

  const replaceIdeas = useCallback((next) => {
    setIdeas(next);
  }, []);

  const addIdea = useCallback((ideaData) => {
    notifyMutation();
    setIdeas((prev) => [...prev, createIdea(ideaData)]);
  }, []);

  const updateIdea = useCallback((id, updates) => {
    notifyMutation();
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const deleteIdea = useCallback((id) => {
    notifyMutation();
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const deleteIdeas = useCallback((ids) => {
    notifyMutation();
    const idSet = new Set(ids);
    setIdeas((prev) => prev.filter((i) => !idSet.has(i.id)));
  }, []);

  const markApproved = useCallback((id, clientComment, boardCardId) => {
    notifyMutation();
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "approved",
              clientComment,
              boardCardId,
              reviewedAt: Date.now(),
            }
          : i,
      ),
    );
  }, []);

  const markDeclined = useCallback((id, clientComment) => {
    notifyMutation();
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "declined",
              clientComment,
              reviewedAt: Date.now(),
            }
          : i,
      ),
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
