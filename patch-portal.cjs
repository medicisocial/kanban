const fs = require("fs");

function write(rel, content) {
  fs.mkdirSync(require("path").dirname(rel), { recursive: true });
  fs.writeFileSync(rel, content, "utf8");
  console.log("Wrote", rel);
}

let constants = fs.readFileSync("src/constants.js", "utf8");
if (!constants.includes("CLIENT_RESPONSES_STORAGE_KEY")) {
  constants = constants.replace(
    "export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';",
    `export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
export const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';`
  );
  fs.writeFileSync("src/constants.js", constants, "utf8");
}

write("src/utils/clientShare.js", `export function getClientPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get("client");
  return client ? decodeURIComponent(client) : null;
}

export function isClientPortal() {
  return Boolean(getClientPortalClient());
}

export function parseShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildClientShareUrl(client, pendingIdeas) {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          client,
          ideas: pendingIdeas,
          sharedAt: Date.now(),
        }),
      ),
    ),
  );
  const base = \`\${window.location.origin}\${window.location.pathname}\`;
  return \`\${base}?client=\${encodeURIComponent(client)}#\${payload}\`;
}

export function mergePortalIdeas(storedIdeas, client, snapshot) {
  const storedPending = storedIdeas.filter(
    (i) => i.client === client && i.status === "pending",
  );

  if (!snapshot?.ideas?.length) return storedPending;

  const byId = new Map(storedPending.map((i) => [i.id, i]));
  for (const idea of snapshot.ideas) {
    if (idea.client === client && idea.status === "pending" && !byId.has(idea.id)) {
      byId.set(idea.id, idea);
    }
  }

  return [...byId.values()];
}

export function loadClientResponses() {
  try {
    const raw = localStorage.getItem("medici-social-client-responses");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveClientResponses(responses) {
  localStorage.setItem("medici-social-client-responses", JSON.stringify(responses));
}

export function queueClientResponse(response) {
  const existing = loadClientResponses();
  const filtered = existing.filter((r) => r.ideaId !== response.ideaId);
  saveClientResponses([...filtered, response]);
}

export function clearClientResponses() {
  localStorage.removeItem("medici-social-client-responses");
}
`);

write("src/hooks/useVideoIdeas.js", `import { useState, useEffect, useCallback } from "react";
import {
  VIDEO_IDEAS_STORAGE_KEY,
  CLIENTS,
} from "../constants";
import { loadClientResponses, clearClientResponses } from "../utils/clientShare";

function createIdea(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    client: CLIENTS[0],
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
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* fall through */
  }
  return getSampleIdeas();
}

export function useVideoIdeas() {
  const [ideas, setIdeas] = useState(loadIdeas);

  useEffect(() => {
    localStorage.setItem(VIDEO_IDEAS_STORAGE_KEY, JSON.stringify(ideas));
  }, [ideas]);

  const addIdea = useCallback((ideaData) => {
    setIdeas((prev) => [...prev, createIdea(ideaData)]);
  }, []);

  const updateIdea = useCallback((id, updates) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const deleteIdea = useCallback((id) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const markApproved = useCallback((id, clientComment, boardCardId) => {
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
    addIdea,
    updateIdea,
    deleteIdea,
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
`);

write("src/components/ClientReviewPortal.jsx", `import { useState, useMemo, useEffect } from "react";
import { CLIENT_COLORS } from "../constants";
import {
  parseShareHash,
  mergePortalIdeas,
  queueClientResponse,
} from "../utils/clientShare";
import VideoIdeaCard from "./VideoIdeaCard";

export default function ClientReviewPortal({
  client,
  ideas,
  onApprove,
  onDecline,
}) {
  const [localIdeas, setLocalIdeas] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const snapshot = parseShareHash();
    const merged = mergePortalIdeas(ideas, client, snapshot);
    setLocalIdeas(merged);
    setDone(merged.length === 0);
  }, [ideas, client]);

  const clientColor = CLIENT_COLORS[client] || "#8b5cf6";

  const handleApprove = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    queueClientResponse({
      ideaId,
      action: "approved",
      comment,
      client,
      idea,
      timestamp: Date.now(),
    });

    onApprove(ideaId, comment, idea);
    setLocalIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    if (localIdeas.length <= 1) setDone(true);
  };

  const handleDecline = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    queueClientResponse({
      ideaId,
      action: "declined",
      comment,
      client,
      idea,
      timestamp: Date.now(),
    });

    onDecline(ideaId, comment);
    setLocalIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    if (localIdeas.length <= 1) setDone(true);
  };

  const pendingCount = localIdeas.length;

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-white/5 bg-[#0f1117]/95 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20"
          >
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Medici Social</p>
            <h1 className="text-lg font-semibold text-white">Video Idea Review</h1>
            <p className="text-sm" style={{ color: clientColor }}>{client}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        {!done ? (
          <>
            <p className="mb-2 text-sm text-gray-300">
              Review the reference videos below. Approve the ideas you want us to produce.
            </p>
            <p className="mb-6 text-xs text-gray-500">
              {pendingCount} idea{pendingCount === 1 ? "" : "s"} waiting for your feedback
            </p>

            <div className="space-y-4">
              {localIdeas.map((idea) => (
                <VideoIdeaCard
                  key={idea.id}
                  idea={idea}
                  reviewMode
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-16 text-center">
            <p className="text-2xl">\u{1F389}</p>
            <h2 className="mt-3 text-lg font-semibold text-white">All caught up!</h2>
            <p className="mt-2 text-sm text-gray-400">
              Thank you for reviewing your video ideas. Medici Social will move approved concepts into production.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
`);

write("src/components/ClientSharePanel.jsx", `import { useState } from "react";
import { CLIENTS, CLIENT_COLORS } from "../constants";
import { buildClientShareUrl } from "../utils/clientShare";

export default function ClientSharePanel({ ideas }) {
  const [copiedClient, setCopiedClient] = useState(null);

  const copyLink = async (client) => {
    const pending = ideas.filter((i) => i.client === client && i.status === "pending");
    const url = buildClientShareUrl(client, pending);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedClient(client);
      setTimeout(() => setCopiedClient(null), 2500);
    } catch {
      window.prompt("Copy this client review link:", url);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-[#1a1d2e] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-white">Share with clients</h3>
      <p className="mt-1 text-xs text-gray-400">
        Copy a private link for each client. They will only see their pending video ideas and can approve or pass on each one.
      </p>
      <div className="mt-4 space-y-2">
        {CLIENTS.map((client) => {
          const pending = ideas.filter((i) => i.client === client && i.status === "pending").length;
          const color = CLIENT_COLORS[client] || "#9ca3af";
          return (
            <div
              key={client}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-gray-200">{client}</span>
                <span className="text-xs text-gray-500">{pending} pending</span>
              </div>
              <button
                type="button"
                onClick={() => copyLink(client)}
                disabled={pending === 0}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedClient === client ? "Link copied!" : "Copy client link"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`);

write("src/App.jsx", `import { useState, useMemo } from "react";
import { useKanban } from "./hooks/useKanban";
import { useVideoIdeas, applyClientResponses } from "./hooks/useVideoIdeas";
import { getClientPortalClient, isClientPortal, loadClientResponses } from "./utils/clientShare";
import Navbar from "./components/Navbar";
import FilterBar from "./components/FilterBar";
import KanbanBoard from "./components/KanbanBoard";
import Calendar from "./components/Calendar";
import ShootDay from "./components/ShootDay";
import VideoIdeas from "./components/VideoIdeas";
import ClientReviewPortal from "./components/ClientReviewPortal";
import CardModal from "./components/CardModal";

function AppShell() {
  const { cards, addCard, createCardFromIdea, updateCard, deleteCard, moveCard } = useKanban();
  const {
    ideas,
    addIdea,
    updateIdea,
    deleteIdea,
    markApproved,
    markDeclined,
  } = useVideoIdeas();

  const [selectedCard, setSelectedCard] = useState(null);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [activeView, setActiveView] = useState("ideas");
  const [responseCount, setResponseCount] = useState(() => loadClientResponses().length);

  const handleCardClick = (card) => setSelectedCard(card);

  const handleUpdate = (id, updates) => {
    updateCard(id, updates);
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
  };

  const handleDelete = (id) => {
    deleteCard(id);
    if (selectedCard?.id === id) setSelectedCard(null);
  };

  const handleApproveIdea = (ideaId, clientComment) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea || idea.status !== "pending") return;
    const boardCardId = createCardFromIdea({ ...idea, clientComment });
    markApproved(ideaId, clientComment, boardCardId);
  };

  const handleDeclineIdea = (ideaId, clientComment) => {
    markDeclined(ideaId, clientComment);
  };

  const handlePortalApprove = (ideaId, clientComment, ideaSnapshot) => {
    const idea = ideas.find((i) => i.id === ideaId) || ideaSnapshot;
    if (ideas.some((i) => i.id === ideaId && i.status !== "pending")) return;
    if (!ideas.some((i) => i.id === ideaId)) {
      addIdea(idea);
    }
    const boardCardId = createCardFromIdea({ ...idea, clientComment });
    markApproved(ideaId, clientComment, boardCardId);
  };

  const handlePortalDecline = (ideaId, clientComment, ideaSnapshot) => {
    if (!ideas.some((i) => i.id === ideaId)) {
      addIdea(ideaSnapshot);
    }
    markDeclined(ideaId, clientComment);
  };

  const handleApplyClientResponses = () => {
    const responses = loadClientResponses();
    if (!responses.length) return;
    const applied = applyClientResponses(ideas, responses, {
      markApproved,
      markDeclined,
      ensureIdeaExists: () => {},
      createCardFromIdea,
      addIdea,
    });
    setResponseCount(0);
    alert(\`Applied \${applied} client response\${applied === 1 ? "" : "s"} to the board.\`);
  };

  const handleGoToBoard = (boardCardId) => {
    const card = cards.find((c) => c.id === boardCardId);
    if (card) {
      setActiveView("board");
      setSelectedCard(card);
    } else {
      setActiveView("board");
    }
  };

  const portalClient = getClientPortalClient();

  if (portalClient) {
    return (
      <ClientReviewPortal
        client={portalClient}
        ideas={ideas}
        onApprove={(id, comment, idea) => handlePortalApprove(id, comment, idea)}
        onDecline={(id, comment, idea) => {
          const snap = idea || ideas.find((i) => i.id === id);
          handlePortalDecline(id, comment, snap);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Navbar
        search={search}
        onSearchChange={setSearch}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <FilterBar clientFilter={clientFilter} onClientChange={setClientFilter} />

      {responseCount > 0 && activeView === "ideas" && (
        <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-200">
              {responseCount} client response{responseCount === 1 ? "" : "s"} ready to sync
            </p>
            <button
              type="button"
              onClick={handleApplyClientResponses}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Apply to board
            </button>
          </div>
        </div>
      )}

      {activeView === "ideas" && (
        <VideoIdeas
          ideas={ideas}
          clientFilter={clientFilter}
          search={search}
          onAddIdea={addIdea}
          onApprove={handleApproveIdea}
          onDecline={handleDeclineIdea}
          onDeleteIdea={deleteIdea}
          onUpdateIdea={updateIdea}
          onGoToBoard={handleGoToBoard}
        />
      )}

      {activeView === "board" && (
        <KanbanBoard
          cards={cards}
          onAddCard={addCard}
          onCardClick={handleCardClick}
          onDeleteCard={handleDelete}
          onMoveCard={moveCard}
          clientFilter={clientFilter}
          search={search}
        />
      )}

      {activeView === "calendar" && (
        <Calendar
          cards={cards}
          clientFilter={clientFilter}
          search={search}
          onCardClick={handleCardClick}
        />
      )}

      {activeView === "shoot" && (
        <ShootDay
          cards={cards}
          clientFilter={clientFilter}
          search={search}
          onCardClick={handleCardClick}
        />
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
`);

let videoIdeas = fs.readFileSync("src/components/VideoIdeas.jsx", "utf8");
videoIdeas = videoIdeas.replace(
  'import AddVideoIdeaModal from "./AddVideoIdeaModal";',
  'import AddVideoIdeaModal from "./AddVideoIdeaModal";\nimport ClientSharePanel from "./ClientSharePanel";'
);
videoIdeas = videoIdeas.replace(
  "  const [pageMode, setPageMode] = useState(\"agency\");",
  "  const [pageMode] = useState(\"agency\");"
);
videoIdeas = videoIdeas.replace(
  /        <div className="flex flex-wrap items-center gap-2">\s*<div className="flex rounded-lg[\s\S]*?<\/div>\s*\{pageMode === "agency" && \(/,
  `        <div className="flex flex-wrap items-center gap-2">
          {pageMode === "agency" && (`
);
videoIdeas = videoIdeas.replace(
  "      {pageMode === \"agency\" ? (\n        <div className=\"mb-4 flex flex-wrap gap-2\">",
  "      {pageMode === \"agency\" && (\n        <ClientSharePanel ideas={ideas} />\n      )}\n\n      {pageMode === \"agency\" ? (\n        <div className=\"mb-4 flex flex-wrap gap-2\">"
);
videoIdeas = videoIdeas.replace(
  /      \) : \(\s*<div className="mb-6 rounded-xl[\s\S]*?<\/div>\s*\)\}/,
  "      ) : null}"
);
fs.writeFileSync("src/components/VideoIdeas.jsx", videoIdeas, "utf8");

console.log("Client portal complete");