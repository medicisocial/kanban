import { useState, useEffect } from "react";
import { useClientsContext } from "../context/ClientsContext";
import {
  parseShareHash,
  mergePortalIdeas,
  buildImportUrl,
} from "../utils/clientShare";
import VideoIdeaCard from "./VideoIdeaCard";

export default function ClientReviewPortal({
  client,
  ideas,
  onApprove,
  onDecline,
}) {
  const { getClientColor } = useClientsContext();
  const [localIdeas, setLocalIdeas] = useState([]);
  const [done, setDone] = useState(false);
  const [sessionResponses, setSessionResponses] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const snapshot = parseShareHash();
    const merged = mergePortalIdeas(ideas, client, snapshot);
    setLocalIdeas(merged);
    setDone(merged.length === 0);
  }, [ideas, client]);

  const clientColor = getClientColor(client);
  const canSyncLocally = ideas.some((i) => i.client === client);

  const recordResponse = (response) => {
    setSessionResponses((prev) => [...prev.filter((r) => r.ideaId !== response.ideaId), response]);
  };

  const handleApprove = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    const response = {
      ideaId,
      action: "approved",
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    recordResponse(response);
    if (canSyncLocally) onApprove(ideaId, comment, idea);

    setLocalIdeas((prev) => {
      const next = prev.filter((i) => i.id !== ideaId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const handleDecline = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    const response = {
      ideaId,
      action: "declined",
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    recordResponse(response);
    if (canSyncLocally) onDecline(ideaId, comment, idea);

    setLocalIdeas((prev) => {
      const next = prev.filter((i) => i.id !== ideaId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const copyImportLink = async () => {
    const url = buildImportUrl(sessionResponses);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link and send it to Medici Social:", url);
    }
  };

  const pendingCount = localIdeas.length;

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/5 bg-black/95 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#810100] to-[#a00000] shadow-lg shadow-[#810100]/20">
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
              Review the ideas below. Approve the ones you want us to produce.
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
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-12 text-center">
            <p className="text-2xl">🎉</p>
            <h2 className="mt-3 text-lg font-semibold text-white">All caught up!</h2>
            <p className="mt-2 text-sm text-gray-400">
              Thank you for reviewing your video ideas.
            </p>
            {sessionResponses.length > 0 && !canSyncLocally && (
              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-sm text-gray-300">Send your approvals to Medici Social</p>
                <p className="mt-1 text-xs text-gray-500">
                  Copy this link and send it to your account manager so approved ideas can be added to the board.
                </p>
                <button
                  type="button"
                  onClick={copyImportLink}
                  className="mt-3 rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white hover:bg-[#a00000]"
                >
                  {copied ? "Link copied!" : "Copy approval link"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
