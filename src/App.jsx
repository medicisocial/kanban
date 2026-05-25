import { useState, useEffect } from "react";
import { useKanban } from "./hooks/useKanban";
import { useVideoIdeas, applyClientResponses } from "./hooks/useVideoIdeas";
import { useShootPlans } from "./hooks/useShootPlans";
import { getClientPortalClient, loadClientResponses, parseImportParam } from "./utils/clientShare";
import {
  getShootPortalParams,
  parseShootImportParam,
  applyShootSubmission,
  loadShootResponses,
  clearShootResponses,
} from "./utils/shootShare";
import {
  getContentReviewPortalClient,
  loadContentReviewResponses,
  parseContentImportParam,
  applyContentReviewResponses,
  buildContentReviewDenyUpdates,
} from "./utils/contentReviewShare";
import { getCalendarPortalClient } from "./utils/calendarShare";
import { hasStoryRecurrence, withStoryOccurrence, parseStoryOccurrenceNotes } from "./utils/calendar";
import { createCard } from "./constants";
import { useEditorTasks } from "./hooks/useEditorTasks";
import EditorTodo from "./components/EditorTodo";
import Navbar from "./components/Navbar";
import FilterBar from "./components/FilterBar";
import KanbanBoard from "./components/KanbanBoard";
import Calendar from "./components/Calendar";
import ShootDay from "./components/ShootDay";
import VideoIdeas from "./components/VideoIdeas";
import ClientReviewPortal from "./components/ClientReviewPortal";
import ClientContentReviewPortal from "./components/ClientContentReviewPortal";
import ClientCalendarPortal from "./components/ClientCalendarPortal";
import ClientShootDayPortal from "./components/ClientShootDayPortal";
import ContentReviewSharePanel from "./components/ContentReviewSharePanel";
import CardModal from "./components/CardModal";
import StaffLogin from "./components/StaffLogin";
import { ClientsProvider } from "./context/ClientsContext";
import { StaffAuthProvider, useStaffAuth } from "./context/StaffAuthContext";

function AppShell() {
  const importData = parseImportParam();
  const shootImportData = parseShootImportParam();
  const contentImportData = parseContentImportParam();

  const { cards, addCard, addCalendarPost, addShootItem, createCardFromIdea, updateCard, deleteCard, moveCard } = useKanban();
  const { plans, getPlan, updatePlan, ensurePlan, deletePlan } = useShootPlans();
  const {
    ideas,
    addIdea,
    updateIdea,
    deleteIdea,
    deleteIdeas,
    markApproved,
    markDeclined,
  } = useVideoIdeas();
  const {
    oneOffTasks,
    taskOrder,
    addOneOffTask,
    toggleOneOffComplete,
    deleteOneOffTask,
    syncTaskOrder,
    setTaskOrderFromIds,
    reorderTasks,
    resetTaskOrder,
  } = useEditorTasks();
  const { authRequired, ready, isAuthenticated, logout } = useStaffAuth();

  const [selectedCard, setSelectedCard] = useState(null);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [activeView, setActiveView] = useState("ideas");
  const [responseCount, setResponseCount] = useState(() => loadClientResponses().length);
  const [contentReviewResponseCount, setContentReviewResponseCount] = useState(
    () => loadContentReviewResponses().length,
  );
  const [shootResponseCount, setShootResponseCount] = useState(
    () => loadShootResponses().length,
  );

  const handleCardClick = (card) => {
    const stored = cards.find((c) => c.id === card.id) || card;
    if (card.occurrenceDate && hasStoryRecurrence(stored)) {
      setSelectedCard(withStoryOccurrence(stored, card.occurrenceDate));
      return;
    }
    setSelectedCard(stored);
  };

  const handleAddCalendarPost = (data) => {
    const id = addCalendarPost(data);
    setSelectedCard(createCard({ ...data, id, columnId: "editing", status: "Editing" }));
    setActiveView("calendar");
  };

  const handleRemoveFromCalendar = (card) => {
    if (card.contentType === "Story") {
      const recurring = card.storyRecurrenceDays?.length > 0;
      const message = recurring
        ? `Remove "${card.title}" from the calendar? This recurring story will be deleted.`
        : `Remove "${card.title}" from the calendar? This story will be deleted.`;
      if (!window.confirm(message)) {
        return;
      }
      deleteCard(card.id);
      if (selectedCard?.id === card.id) {
        setSelectedCard(null);
      }
      return;
    }

    if (
      !window.confirm(
        `Remove "${card.title}" from the calendar? The card will stay on the board in ${card.columnId === "scheduled" ? "Scheduled" : "Editing"} without a plan date.`,
      )
    ) {
      return;
    }
    updateCard(card.id, { dueDate: "", dueTime: "" });
    setSelectedCard((prev) =>
      prev?.id === card.id ? { ...prev, dueDate: "", dueTime: "" } : prev,
    );
  };

  const handleAddShootItem = (data) => {
    ensurePlan(data.client, data.shootDate);
    const id = addShootItem(data);
    setSelectedCard(
      createCard({
        ...data,
        id,
        columnId: "shoot",
        status: "To Shoot",
        shootDuration: 45,
      }),
    );
    return id;
  };

  const handleRemoveFromShootSchedule = (card) => {
    if (
      !window.confirm(
        `Remove "${card.title}" from this shoot schedule? The card will stay on the board without a shoot date.`,
      )
    ) {
      return;
    }
    updateCard(card.id, { shootDate: "", shootTime: "" });
    setSelectedCard((prev) =>
      prev?.id === card.id ? { ...prev, shootDate: "", shootTime: "" } : prev,
    );
  };

  const handleRemoveClientShoot = (client, dateKey, clientCards) => {
    const count = clientCards.length;
    const message = count
      ? `Remove ${client}'s shoot from this day? ${count} item${count === 1 ? "" : "s"} will stay on the board but lose their shoot date.`
      : `Remove ${client}'s shoot from this day?`;
    if (!window.confirm(message)) return;

    for (const card of clientCards) {
      updateCard(card.id, { shootDate: "", shootTime: "" });
    }
    deletePlan(client, dateKey);
    setSelectedCard((prev) =>
      prev?.client === client && prev?.shootDate === dateKey
        ? { ...prev, shootDate: "", shootTime: "" }
        : prev,
    );
  };

  const handleUpdate = (id, updates) => {
    updateCard(id, updates);
    setSelectedCard((prev) => {
      if (prev?.id !== id) return prev;
      const next = { ...prev, ...updates };
      if (updates.storyOccurrenceNotes && prev.occurrenceDate) {
        const overrides = parseStoryOccurrenceNotes(updates.storyOccurrenceNotes);
        next.notes = overrides[prev.occurrenceDate] ?? prev.notes;
        next.storyOccurrenceNotes = overrides;
      }
      return next;
    });
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
    alert(`Applied ${applied} client response${applied === 1 ? "" : "s"} to the board.`);
  };

  const handleContentReviewApprove = (cardId, comment) => {
    updateCard(cardId, {
      columnId: "approved",
      status: "Approved",
      clientComment: comment || "",
    });
  };

  const handleContentReviewDeny = (cardId, comment) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const trimmed = (comment || '').trim();
    if (!trimmed) return;
    updateCard(cardId, buildContentReviewDenyUpdates(card, trimmed));
  };

  const handleApplyContentReviewResponses = () => {
    const responses = loadContentReviewResponses();
    if (!responses.length) return;
    const applied = applyContentReviewResponses(cards, responses, { updateCard });
    setContentReviewResponseCount(0);
    alert(`Applied ${applied} content review response${applied === 1 ? "" : "s"} to the board.`);
  };

  const handleApplyShootResponses = () => {
    const responses = loadShootResponses();
    if (!responses.length) return;
    let applied = 0;
    for (const submission of responses) {
      applied += applyShootSubmission(submission, cards, { updateCard, updatePlan });
    }
    clearShootResponses();
    setShootResponseCount(0);
    alert(
      `Applied ${responses.length} client shoot schedule${responses.length === 1 ? "" : "s"} (${applied} item${applied === 1 ? "" : "s"} updated).`,
    );
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

  useEffect(() => {
    if (!importData?.responses?.length) return;
    const applied = applyClientResponses(ideas, importData.responses, {
      markApproved,
      markDeclined,
      ensureIdeaExists: () => {},
      createCardFromIdea,
      addIdea,
    });
    if (applied > 0) {
      window.history.replaceState({}, "", window.location.pathname);
      alert(`Imported ${applied} client approval${applied === 1 ? "" : "s"} to the board.`);
      setActiveView("board");
    }
  }, []);

  useEffect(() => {
    const submission = shootImportData?.responses;
    if (!submission?.client || !submission?.dateKey) return;

    const applied = applyShootSubmission(submission, cards, { updateCard, updatePlan });
    window.history.replaceState({}, "", window.location.pathname);
    if (applied > 0) {
      alert(
        `Imported shoot schedule for ${submission.client} (${applied} item${applied === 1 ? "" : "s"}).`,
      );
      setActiveView("shoot");
    }
  }, []);

  useEffect(() => {
    if (!contentImportData?.responses?.length) return;
    const applied = applyContentReviewResponses(cards, contentImportData.responses, { updateCard });
    if (applied > 0) {
      window.history.replaceState({}, "", window.location.pathname);
      alert(`Imported ${applied} content review response${applied === 1 ? "" : "s"} to the board.`);
      setActiveView("board");
    }
  }, []);

  const portalClient = getClientPortalClient();
  const contentReviewClient = getContentReviewPortalClient();
  const calendarPortalClient = getCalendarPortalClient();
  const shootPortal = getShootPortalParams();

  if (shootPortal) {
    const plan = getPlan(shootPortal.client, shootPortal.dateKey);
    return (
      <ClientShootDayPortal
        client={shootPortal.client}
        dateKey={shootPortal.dateKey}
        cards={cards}
        plan={plan}
        onUpdateCard={updateCard}
        onUpdatePlan={(updates) => updatePlan(shootPortal.client, shootPortal.dateKey, updates)}
      />
    );
  }

  if (calendarPortalClient) {
    return (
      <ClientCalendarPortal
        client={calendarPortalClient}
        cards={cards}
      />
    );
  }

  if (contentReviewClient) {
    return (
      <ClientContentReviewPortal
        client={contentReviewClient}
        cards={cards}
        onApprove={handleContentReviewApprove}
        onDeny={handleContentReviewDeny}
      />
    );
  }

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

  if (authRequired && !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (authRequired && !isAuthenticated) {
    return <StaffLogin />;
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Navbar
        search={search}
        onSearchChange={setSearch}
        activeView={activeView}
        onViewChange={setActiveView}
        onSignOut={authRequired ? logout : undefined}
      />

      <FilterBar clientFilter={clientFilter} onClientChange={setClientFilter} />

      {contentReviewResponseCount > 0 && activeView === "board" && (
        <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
            <p className="text-sm text-violet-200">
              {contentReviewResponseCount} content review response{contentReviewResponseCount === 1 ? "" : "s"} ready to sync
            </p>
            <button
              type="button"
              onClick={handleApplyContentReviewResponses}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              Apply to board
            </button>
          </div>
        </div>
      )}

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
          onDeleteIdeas={deleteIdeas}
          onUpdateIdea={updateIdea}
          onGoToBoard={handleGoToBoard}
        />
      )}

      {activeView === "board" && (
        <>
          <ContentReviewSharePanel cards={cards} />
          <KanbanBoard
            cards={cards}
            onAddCard={addCard}
            onCardClick={handleCardClick}
            onDeleteCard={handleDelete}
            onMoveCard={moveCard}
            clientFilter={clientFilter}
            search={search}
          />
        </>
      )}

      {activeView === "calendar" && (
        <Calendar
          cards={cards}
          clientFilter={clientFilter}
          search={search}
          onCardClick={handleCardClick}
          onAddCalendarPost={handleAddCalendarPost}
          onRemoveFromCalendar={handleRemoveFromCalendar}
        />
      )}

      {activeView === "todo" && (
        <EditorTodo
          cards={cards}
          oneOffTasks={oneOffTasks}
          taskOrder={taskOrder}
          search={search}
          clientFilter={clientFilter}
          onAddOneOffTask={addOneOffTask}
          onToggleOneOffComplete={toggleOneOffComplete}
          onDeleteOneOffTask={deleteOneOffTask}
          onOpenCard={handleCardClick}
          onSyncTaskOrder={syncTaskOrder}
          onSetTaskOrder={setTaskOrderFromIds}
          onReorderTasks={reorderTasks}
          onResetTaskOrder={resetTaskOrder}
        />
      )}

      {shootResponseCount > 0 && activeView === "shoot" && (
        <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-200">
              {shootResponseCount} client shoot schedule{shootResponseCount === 1 ? "" : "s"} ready to sync
            </p>
            <button
              type="button"
              onClick={handleApplyShootResponses}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Apply to Shoot Schedule
            </button>
          </div>
        </div>
      )}

      {activeView === "shoot" && (
        <ShootDay
          cards={cards}
          clientFilter={clientFilter}
          search={search}
          plans={plans}
          onCardClick={handleCardClick}
          onUpdateCard={updateCard}
          onAddShootItem={handleAddShootItem}
          getPlan={getPlan}
          onUpdatePlan={updatePlan}
          onEnsurePlan={ensurePlan}
          onRemoveFromSchedule={handleRemoveFromShootSchedule}
          onRemoveClientShoot={handleRemoveClientShoot}
        />
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StaffAuthProvider>
      <ClientsProvider>
        <AppShell />
      </ClientsProvider>
    </StaffAuthProvider>
  );
}
