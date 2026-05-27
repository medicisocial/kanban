import { useState, useEffect, useMemo } from "react";
import { useKanban } from "../hooks/useKanban";
import { useVideoIdeas, applyClientResponses } from "../hooks/useVideoIdeas";
import { useShootPlans } from "../hooks/useShootPlans";
import { getClientPortalClient, loadClientResponses, parseImportParam } from "../utils/clientShare";
import {
  getShootPortalParams,
  parseShootImportParam,
  applyShootSubmission,
  loadShootResponses,
  clearShootResponses,
} from "../utils/shootShare";
import {
  getContentReviewPortalClient,
  loadContentReviewResponses,
  parseContentImportParam,
  applyContentReviewResponses,
  buildContentReviewDenyUpdates,
} from "../utils/contentReviewShare";
import { getCalendarPortalClient } from "../utils/calendarShare";
import { withStoryOccurrence, parseStoryOccurrenceNotes } from "../utils/calendar";
import { createCard, COLUMNS } from "../constants";
import { buildSendBackForEditingUpdates } from "../utils/editorTodo";
import { useAdminTasks } from "../hooks/useAdminTasks";
import { useEvents } from "../hooks/useEvents";
import CompanyTasks from "./CompanyTasks";
import AdminConsoleLayout from "./clientPortal/AdminConsoleLayout";
import KanbanBoard from "./KanbanBoard";
import UnifiedCalendarsPage from "./UnifiedCalendarsPage";
import ShootDay from "./ShootDay";
import VideoIdeas from "./VideoIdeas";
import WorkspaceHomePage from "./WorkspaceHomePage";
import WorkspaceSettingsPage from "./WorkspaceSettingsPage";
import ClientReviewPortal from "./ClientReviewPortal";
import ClientContentReviewPortal from "./ClientContentReviewPortal";
import ClientCalendarPortal from "./ClientCalendarPortal";
import ClientShootDayPortal from "./ClientShootDayPortal";
import WorkspaceNotificationsPanel from "./WorkspaceNotificationsPanel";
import HandoffModal from "./HandoffModal";
import ClientManagementPage from "./ClientManagementPage";
import TeamManagementPage from "./TeamManagementPage";
import CardModal from "./CardModal";
import { useStaffAuth } from "../context/StaffAuthContext";
import { useClientsContext } from "../context/ClientsContext";
import { getDefaultWorkspaceView } from "../utils/getDefaultWorkspaceView";
import { resolveStaffMemberName } from "../utils/staffMembers";
import { buildWorkspaceAlerts } from "../utils/workspaceNotifications";
import { usesPersonalWorkspaceView } from "../utils/staffAuth";

export default function AppShell({ onSignOut }) {
  const importData = parseImportParam();
  const shootImportData = parseShootImportParam();
  const contentImportData = parseContentImportParam();

  const { cards, addCard, addCalendarPost, addShootItem, createCardFromIdea, updateCard, deleteCard, moveCard, markAsPosted, addOneOffProject } = useKanban();
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
    adminTasks,
    addAdminTask,
    toggleAdminTaskComplete,
    deleteAdminTask,
  } = useAdminTasks();
  const { events, addEvent, updateEvent, deleteEvent } = useEvents();
  const { authRequired, ready, logout, session } = useStaffAuth();
  const { teamMembers, clientAccountManagers } = useClientsContext();

  const [selectedCard, setSelectedCard] = useState(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [activeView, setActiveView] = useState("home");
  const [viewInitialized, setViewInitialized] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [handoffCard, setHandoffCard] = useState(null);
  const [responseCount, setResponseCount] = useState(() => loadClientResponses().length);
  const [contentReviewResponseCount, setContentReviewResponseCount] = useState(
    () => loadContentReviewResponses().length,
  );
  const [shootResponseCount, setShootResponseCount] = useState(
    () => loadShootResponses().length,
  );

  const handleCardClick = (card) => {
    const stored = cards.find((c) => c.id === card.id) || card;
    if (card.occurrenceDate && stored.contentType === "Story") {
      setSelectedCard(withStoryOccurrence(stored, card.occurrenceDate));
      return;
    }
    setSelectedCard(stored);
  };

  useEffect(() => {
    if (!ready || viewInitialized) return;
    if (session) {
      setActiveView(getDefaultWorkspaceView(session, teamMembers));
    }
    setViewInitialized(true);
  }, [ready, session, teamMembers, viewInitialized]);

  useEffect(() => {
    if (!selectedCard) return;
    const fresh = cards.find((c) => c.id === selectedCard.id);
    if (!fresh) return;
    setSelectedCard((prev) => {
      if (!prev || prev.id !== fresh.id) return prev;
      if (prev.occurrenceDate && fresh.contentType === "Story") {
        return withStoryOccurrence(fresh, prev.occurrenceDate);
      }
      return { ...fresh, occurrenceDate: prev.occurrenceDate };
    });
  }, [cards, selectedCard?.id]);

  useEffect(() => {
    if (authRequired && ready && !session && onSignOut) {
      onSignOut();
    }
  }, [authRequired, ready, session, onSignOut]);

  const handleAddCalendarPost = (data) => {
    const id = addCalendarPost(data);
    setSelectedCard(createCard({ ...data, id, columnId: "editing", status: "Editing" }));
    setActiveView("calendars");
  };

  const handleMarkScheduled = (cardId) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === "scheduled") return;
    updateCard(cardId, {
      columnId: "scheduled",
      status: "Scheduled",
    });
  };

  const handleMarkPosted = (cardId, occurrenceDate) => {
    markAsPosted(cardId, occurrenceDate);
  };

  const handleSubmitForReview = (cardId) => {
    moveCard(cardId, "in-review");
  };

  const handleApproveReview = (cardId) => {
    moveCard(cardId, "approved");
  };

  const handleSendBackForEditing = (cardId, comment = '') => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    updateCard(cardId, buildSendBackForEditingUpdates(card, comment));
  };

  const handleMoveCard = (cardId, targetColumnId) => {
    const card = cards.find((c) => c.id === cardId);
    if (card?.columnId === "shoot" && targetColumnId === "editing") {
      setHandoffCard(card);
      return;
    }
    moveCard(cardId, targetColumnId);
  };

  const handleMoveEditorTask = (cardId, columnId) => {
    handleMoveCard(cardId, columnId);
  };

  const handleHandoffRequest = (card) => {
    setHandoffCard(card);
  };

  const handleConfirmHandoff = (note) => {
    if (!handoffCard) return;
    moveCard(handoffCard.id, "editing");
    if (note) {
      const existing = handoffCard.notes?.trim();
      const stamped = `[Handoff ${new Date().toLocaleDateString()}] ${note}`;
      updateCard(handoffCard.id, {
        notes: existing ? `${existing}\n\n${stamped}` : stamped,
      });
    }
    setHandoffCard(null);
  };

  const handleDeleteOneOffProject = (cardId) => {
    deleteCard(cardId);
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
        `Remove "${card.title}" from the calendar? The card will stay on the board in ${COLUMNS.find((col) => col.id === card.columnId)?.title || card.columnId} without a plan date.`,
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
        status: "To Create",
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
    updateCard(card.id, { shootDate: "", shootTime: "", shootEndTime: "" });
    setSelectedCard((prev) =>
      prev?.id === card.id ? { ...prev, shootDate: "", shootTime: "", shootEndTime: "" } : prev,
    );
  };

  const handleRemoveClientShoot = (client, dateKey, clientCards) => {
    const count = clientCards.length;
    const message = count
      ? `Remove ${client}'s shoot from this day? ${count} item${count === 1 ? "" : "s"} will stay on the board but lose their shoot date.`
      : `Remove ${client}'s shoot from this day?`;
    if (!window.confirm(message)) return;

    for (const card of clientCards) {
      updateCard(card.id, { shootDate: "", shootTime: "", shootEndTime: "" });
    }
    deletePlan(client, dateKey);
    setSelectedCard((prev) =>
      prev?.client === client && prev?.shootDate === dateKey
        ? { ...prev, shootDate: "", shootTime: "", shootEndTime: "" }
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
    const syncPendingClientUpdates = () => {
      const contentResponses = loadContentReviewResponses();
      if (contentResponses.length) {
        applyContentReviewResponses(cards, contentResponses, { updateCard });
      }
      setContentReviewResponseCount(loadContentReviewResponses().length);

      const ideaResponses = loadClientResponses();
      if (ideaResponses.length) {
        applyClientResponses(ideas, ideaResponses, {
          markApproved,
          markDeclined,
          ensureIdeaExists: () => {},
          createCardFromIdea,
          addIdea,
        });
      }
      setResponseCount(loadClientResponses().length);

      const shootResponses = loadShootResponses();
      if (shootResponses.length) {
        let applied = 0;
        for (const submission of shootResponses) {
          applied += applyShootSubmission(submission, cards, { updateCard, updatePlan });
        }
        if (applied > 0) clearShootResponses();
      }
      setShootResponseCount(loadShootResponses().length);
    };

    syncPendingClientUpdates();
    window.addEventListener("storage", syncPendingClientUpdates);
    return () => window.removeEventListener("storage", syncPendingClientUpdates);
  }, [
    cards,
    ideas,
    updateCard,
    updatePlan,
    markApproved,
    markDeclined,
    createCardFromIdea,
    addIdea,
  ]);

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
    setResponseCount(loadClientResponses().length);
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
    setContentReviewResponseCount(loadContentReviewResponses().length);
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  const handleSignOut = () => {
    logout();
    onSignOut?.();
  };

  const syncTotal = responseCount + contentReviewResponseCount + shootResponseCount;
  const staffName = resolveStaffMemberName(session, teamMembers);
  const myWorkOnly = usesPersonalWorkspaceView(session);
  const workspaceAlerts = useMemo(
    () =>
      buildWorkspaceAlerts({
        cards,
        ideas,
        clientFilter,
        staffName,
        clientAccountManagers,
        myWorkOnly,
      }),
    [cards, ideas, clientFilter, staffName, clientAccountManagers, myWorkOnly],
  );
  const notificationCount = syncTotal + workspaceAlerts.length;

  const handleNotificationNavigate = (view) => {
    setActiveView(view);
    setNotificationsOpen(false);
  };

  return (
    <AdminConsoleLayout
      activeView={activeView}
      onViewChange={setActiveView}
      notificationCount={notificationCount}
      notificationsOpen={notificationsOpen}
      onNotificationsOpenChange={setNotificationsOpen}
      notificationPanel={
        <WorkspaceNotificationsPanel
          ideaCount={responseCount}
          contentReviewCount={contentReviewResponseCount}
          shootCount={shootResponseCount}
          alerts={workspaceAlerts}
          onApplyIdeas={handleApplyClientResponses}
          onApplyContentReview={handleApplyContentReviewResponses}
          onApplyShoot={handleApplyShootResponses}
          onNavigate={handleNotificationNavigate}
        />
      }
      profileLabel={session?.username || 'Staff'}
      onSignOut={onSignOut ? handleSignOut : undefined}
      clientFilter={clientFilter}
      onClientChange={setClientFilter}
      homeNavLabel={myWorkOnly ? 'My work' : 'Overview'}
    >
      {activeView === "home" && (
        <WorkspaceHomePage
          cards={cards}
          ideas={ideas}
          adminTasks={adminTasks}
          clientFilter={clientFilter}
          syncTotal={syncTotal}
          staffName={staffName}
          clientAccountManagers={clientAccountManagers}
          myWorkOnly={myWorkOnly}
          onNavigate={setActiveView}
          onOpenCard={handleCardClick}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
      )}

      {activeView === "ideas" && (
        <VideoIdeas
          ideas={ideas}
          clientFilter={clientFilter}
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
        <section>
          <KanbanBoard
            cards={cards}
            onAddCard={addCard}
            onCardClick={handleCardClick}
            onDeleteCard={handleDelete}
            onMoveCard={handleMoveCard}
            clientFilter={clientFilter}
            embedded
            staffName={staffName}
            clientAccountManagers={clientAccountManagers}
          />
        </section>
      )}

      {activeView === "calendars" && (
        <UnifiedCalendarsPage
          cards={cards}
          events={events}
          clientFilter={clientFilter}
          onCardClick={handleCardClick}
          onAddCalendarPost={handleAddCalendarPost}
          onRemoveFromCalendar={handleRemoveFromCalendar}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
        />
      )}

      {activeView === "todo" && (
        <CompanyTasks
          cards={cards}
          adminTasks={adminTasks}
          clientFilter={clientFilter}
          embedded
          onAddOneOffTask={addOneOffProject}
          onDeleteOneOffTask={handleDeleteOneOffProject}
          onAddAdminTask={addAdminTask}
          onToggleAdminTaskComplete={toggleAdminTaskComplete}
          onDeleteAdminTask={deleteAdminTask}
          onOpenCard={handleCardClick}
          onMarkScheduled={handleMarkScheduled}
          onMarkPosted={handleMarkPosted}
          onSubmitForReview={handleSubmitForReview}
          onApproveReview={handleApproveReview}
          onSendBackForEditing={handleSendBackForEditing}
          onMoveTask={handleMoveEditorTask}
          onHandoff={handleHandoffRequest}
          onNavigate={setActiveView}
        />
      )}

      {activeView === "shoot" && (
        <ShootDay
          cards={cards}
          clientFilter={clientFilter}
          plans={plans}
          onCardClick={handleCardClick}
          onUpdateCard={updateCard}
          onAddShootItem={handleAddShootItem}
          getPlan={getPlan}
          onUpdatePlan={updatePlan}
          onEnsurePlan={ensurePlan}
          onRemoveFromSchedule={handleRemoveFromShootSchedule}
          onRemoveClientShoot={handleRemoveClientShoot}
          embedded
        />
      )}

      {activeView === "clients" && (
        <ClientManagementPage cards={cards} ideas={ideas} />
      )}

      {activeView === "team" && (
        <TeamManagementPage />
      )}

      {activeView === "settings" && (
        <WorkspaceSettingsPage
          clientFilter={clientFilter}
          onClientChange={setClientFilter}
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

      <HandoffModal
        card={handoffCard}
        editorName={handoffCard?.assignedTo}
        onConfirm={handleConfirmHandoff}
        onCancel={() => setHandoffCard(null)}
      />
    </AdminConsoleLayout>
  );
}
