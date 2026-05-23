import { useState, useMemo, useEffect } from "react";
import { useClientsContext } from "../context/ClientsContext";
import VideoIdeaCard from "./VideoIdeaCard";
import VideoIdeaModal from "./VideoIdeaModal";
import ClientSharePanel from "./ClientSharePanel";

export default function VideoIdeas({
  ideas,
  clientFilter,
  search,
  onAddIdea,
  onApprove,
  onDecline,
  onDeleteIdea,
  onDeleteIdeas,
  onUpdateIdea,
  onGoToBoard,
}) {
  const { clients } = useClientsContext();
  const [pageMode] = useState("agency");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewClient, setReviewClient] = useState(() => clients[0]);
  const [ideaModal, setIdeaModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const isBulkDeleteView = statusFilter === "approved" || statusFilter === "declined";
  const bulkDeleteLabel = statusFilter === "declined" ? "passed idea" : "approved idea";

  useEffect(() => {
    if (!clients.includes(reviewClient)) {
      setReviewClient(clients[0] || "");
    }
  }, [clients, reviewClient]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter]);

  const filteredIdeas = useMemo(() => {
    let list = ideas;

    if (pageMode === "review") {
      list = list.filter((i) => i.client === reviewClient && i.status === "pending");
    } else {
      if (clientFilter && clientFilter !== "all") {
        list = list.filter((i) => i.client === clientFilter);
      }
      if (statusFilter !== "all") {
        list = list.filter((i) => i.status === statusFilter);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        [i.title, i.client, i.description, i.clientComment, i.referenceVideo]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return list;
  }, [ideas, pageMode, reviewClient, clientFilter, statusFilter, search]);

  const pendingCount = ideas.filter((i) => i.status === "pending").length;
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    filteredIdeas.length > 0 && filteredIdeas.every((idea) => selectedIds.has(idea.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredIdeas.map((idea) => idea.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    const label =
      selectedCount === 1 ? `1 ${bulkDeleteLabel}` : `${selectedCount} ${bulkDeleteLabel}s`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    onDeleteIdeas([...selectedIds]);
    setSelectedIds(new Set());
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Video Ideas</h2>
          <p className="mt-1 text-sm text-gray-400">
            Share video ideas with clients. Approved ideas move to the board.
          </p>
          {pendingCount > 0 && (
            <p className="mt-1 text-xs text-amber-400">{pendingCount} awaiting client review</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pageMode === "agency" && (
            <button
              type="button"
              onClick={() => setIdeaModal("add")}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              + Add Idea
            </button>
          )}
        </div>
      </div>

      {pageMode === "agency" && (
        <ClientSharePanel ideas={ideas} />
      )}

      {pageMode === "agency" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { id: "pending", label: "Pending" },
            { id: "approved", label: "Approved" },
            { id: "declined", label: "Passed" },
            { id: "all", label: "All" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === id
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {isBulkDeleteView && filteredIdeas.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3">
          <p className="text-sm text-gray-400">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : "Select ideas to delete in bulk"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={allVisibleSelected ? clearSelection : selectAllVisible}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0}
              className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>
      )}

      {filteredIdeas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#1a1d2e] px-6 py-16 text-center">
          <p className="text-sm text-gray-400">
            {pageMode === "review"
              ? `No pending ideas for ${reviewClient}.`
              : "No video ideas in this view."}
          </p>
          {pageMode === "agency" && (
            <button
              type="button"
              onClick={() => setIdeaModal("add")}
              className="mt-3 text-sm text-violet-400 hover:text-violet-300"
            >
              Add your first video idea
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIdeas.map((idea) => (
            <VideoIdeaCard
              key={idea.id}
              idea={idea}
              reviewMode={pageMode === "review"}
              selectable={isBulkDeleteView}
              selected={selectedIds.has(idea.id)}
              onSelectToggle={toggleSelected}
              onApprove={onApprove}
              onDecline={onDecline}
              onDelete={onDeleteIdea}
              onEdit={setIdeaModal}
              onGoToBoard={onGoToBoard}
            />
          ))}
        </div>
      )}

      {ideaModal && (
        <VideoIdeaModal
          idea={ideaModal === "add" ? null : ideaModal}
          defaultClient={clientFilter}
          onClose={() => setIdeaModal(null)}
          onSave={(data) => {
            if (ideaModal === "add") {
              onAddIdea(data);
            } else {
              onUpdateIdea(ideaModal.id, data);
            }
          }}
        />
      )}
    </div>
  );
}
