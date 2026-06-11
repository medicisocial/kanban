import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from "react";
import { SUPABASE_ENABLED } from "../lib/supabaseClient";
import { useKanban } from "../hooks/useKanban";
import { useVideoIdeas, applyClientResponses } from "../hooks/useVideoIdeas";
import { useShootPlans } from "../hooks/useShootPlans";
import { useUndoHistory } from "../hooks/useUndoHistory";
import { beginBatch, endBatch, runWithoutUndoCapture } from "../utils/undoHistory";
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
import { useMeetings } from "../hooks/useMeetings";
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
import ClientFilesWorkspacePage from "./ClientFilesWorkspacePage";
import TeamManagementPage from "./TeamManagementPage";
import PlanPostDateModal from "./PlanPostDateModal";
import PlanShootDateModal from "./PlanShootDateModal";
import AddShootDayModal from "./AddShootDayModal";
import AddExistingToShootModal from "./AddExistingToShootModal";
import CardModal from "./CardModal";
import { useStaffAuth } from "../context/StaffAuthContext";
import { useClientsContext } from "../context/ClientsContext";
import { getDefaultWorkspaceView } from "../utils/getDefaultWorkspaceView";
import {
  readViewTabFromUrl,
  readWorkspaceViewFromUrl,
  syncWorkspaceViewUrl,
} from "../utils/workspaceViewUrl";
import { resolveStaffMemberAvatar, resolveStaffDisplayName, staffHasAccountManagerQueueAccess } from "../utils/staffMembers";
import { isSharedOperationsLogin } from "../utils/staffAuth";
import { buildWorkspaceAlerts } from "../utils/workspaceNotifications";
import { buildWorkspaceHomeSummary, buildNavBadgeCounts } from "../utils/workspaceHome";
import { useStaffWorkspaceScope } from "../hooks/useStaffWorkspaceScope";
import { scopeAdminTasksForStaff, scopeCardsForStaff } from "../utils/staffWorkspaceScope";
import { canReturnCardToVault, findIdeaBoardCard, getVaultIdeas } from "../utils/videoIdeas";

export default function AppShell({ onSignOut }) {
  const importData = parseImportParam();
  const shootImportData = parseShootImportParam();
  const contentImportData = parseContentImportParam();

  const {
    cards,
    cardsSyncLoaded,
    replaceCards,
    addCard,
    addCalendarPost,
    addShootItem,
    createCardFromIdea,
    updateCard,
    deleteCard,
    moveCard,
    markAsPosted,
    addOneOffProject,
  } = useKanban();
  const { plans, replacePlans, getPlan, updatePlan, ensurePlan, deletePlan } = useShootPlans();
  const {
    ideas,
    ideasSyncLoaded,
    replaceIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    deleteIdeas,
    markApproved,
    markDeclined,
  } = useVideoIdeas();
  const {
    adminTasks,
    replaceAdminTasks,
    addAdminTask,
    toggleAdminTaskComplete,
    deleteAdminTask,
  } = useAdminTasks();
  const { events, replaceEvents, addEvent, updateEvent, deleteEvent } = useEvents();
  const { meetings, meetingsSyncLoaded, replaceMeetings, addMeeting, updateMeeting, deleteMeeting } =
    useMeetings();
  const { authRequired, ready, logout, session, org, orgReady } = useStaffAuth();
  const { teamMembers, clientAccountManagers, getClientColor } = useClientsContext();

  const { canUndo, undo } = useUndoHistory({
    cards,
    plans,
    ideas,
    adminTasks,
    events,
    meetings,
    replaceCards,
    replacePlans,
    replaceIdeas,
    replaceAdminTasks,
    replaceEvents,
    replaceMeetings,
  });

  const [selectedCard, setSelectedCard] = useState(null);
  const [clientFilter, setClientFilterState] = useState("all");
  const setClientFilter = useCallback((next) => {
    startTransition(() => setClientFilterState(next));
  }, []);
  const [activeView, setActiveView] = useState(() => readWorkspaceViewFromUrl() || "home");
  const [viewInitialized, setViewInitialized] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tasksRole, setTasksRole] = useState(() => readViewTabFromUrl('todo') || 'creator');
  const [calendarsTab, setCalendarsTab] = useState(() => readViewTabFromUrl('calendars') || 'content');
  const [clientsTab, setClientsTab] = useState(() => readViewTabFromUrl('clients') || 'profile');
  const [shootFocus, setShootFocus] = useState(null);
  const [openMeetingRequest, setOpenMeetingRequest] = useState(null);
  const [handoffCard, setHandoffCard] = useState(null);
  const [planDateCard, setPlanDateCard] = useState(null);
  const [shootDateCard, setShootDateCard] = useState(null);
  const [quickAddShootItem, setQuickAddShootItem] = useState(null);
  const [assignToShoot, setAssignToShoot] = useState(null);
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

  const handleNavigate = useCallback((view, options = {}) => {
    if (options?.tasksRole) {
      setTasksRole(options.tasksRole);
    }
    if (options?.calendarsTab) {
      setCalendarsTab(options.calendarsTab);
    }
    if (options?.openMeeting) {
      setOpenMeetingRequest({ meeting: options.openMeeting, token: Date.now() });
    }
    if (options?.shootDate) {
      setShootFocus({
        dateKey: options.shootDate,
        client: options.shootClient || null,
        token: Date.now(),
      });
    }
    if (view !== 'shoot') {
      setShootFocus(null);
    }
    setActiveView(view);
  }, []);

  useEffect(() => {
    if (!selectedCard) return;
    if (!cards.some((c) => c.id === selectedCard.id)) {
      setSelectedCard(null);
    }
  }, [cards, selectedCard?.id]);

  useEffect(() => {
    if (!ready || viewInitialized) return;
    const fromUrl = readWorkspaceViewFromUrl();
    if (!fromUrl && session) {
      setActiveView(getDefaultWorkspaceView(session, teamMembers));
    }
    setViewInitialized(true);
  }, [ready, session, teamMembers, viewInitialized]);

  useEffect(() => {
    if (!viewInitialized) return;
    const tab =
      activeView === 'calendars'
        ? calendarsTab
        : activeView === 'todo'
          ? tasksRole
          : activeView === 'clients'
            ? clientsTab
            : null;
    syncWorkspaceViewUrl(activeView, { tab });
  }, [activeView, calendarsTab, tasksRole, clientsTab, viewInitialized]);

  useEffect(() => {
    if (!selectedCard) return;
    const fresh = cards.find((c) => c.id === selectedCard.id);
    if (!fresh) return;
    setSelectedCard((prev) => {
      if (!prev || prev.id !== fresh.id) return prev;
      if (prev.updatedAt === fresh.updatedAt) {
        if (prev.occurrenceDate && fresh.contentType === "Story") {
          return withStoryOccurrence(fresh, prev.occurrenceDate);
        }
        return prev;
      }
      if (prev.occurrenceDate && fresh.contentType === "Story") {
        return withStoryOccurrence(fresh, prev.occurrenceDate);
      }
      return { ...fresh, occurrenceDate: prev.occurrenceDate };
    });
  }, [cards, selectedCard?.id]);

  useEffect(() => {
    if (!planDateCard) return;
    const fresh = cards.find((c) => c.id === planDateCard.id);
    if (fresh) setPlanDateCard(fresh);
  }, [cards, planDateCard?.id]);

  useEffect(() => {
    if (!shootDateCard) return;
    const fresh = cards.find((c) => c.id === shootDateCard.id);
    if (fresh) setShootDateCard(fresh);
  }, [cards, shootDateCard?.id]);

  useEffect(() => {
    if (!authRequired || !ready || session) return;
    // Session was cleared during auth restore (e.g. stale login). Return to sign-in.
    onSignOut?.();
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
    beginBatch();
    try {
      moveCard(handoffCard.id, "editing");
      if (note) {
        const existing = handoffCard.notes?.trim();
        const stamped = `[Handoff ${new Date().toLocaleDateString()}] ${note}`;
        updateCard(handoffCard.id, {
          notes: existing ? `${existing}\n\n${stamped}` : stamped,
        });
      }
    } finally {
      endBatch();
    }
    setHandoffCard(null);
  };

  const handleDeleteOneOffProject = (cardId) => {
    deleteCard(cardId);
  };

  const handleMoveCalendarPost = (cardId, dueDate) => {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card || !dueDate || card.dueDate === dueDate) return;
    beginBatch();
    try {
      updateCard(cardId, { dueDate });
      setSelectedCard((prev) =>
        prev?.id === cardId ? { ...prev, dueDate } : prev,
      );
    } finally {
      endBatch();
    }
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

  const handleAddShootItem = (data, { openCard = true, addAnother = false } = {}) => {
    beginBatch();
    let id;
    try {
      ensurePlan(data.client, data.shootDate);
      id = addShootItem(data);
    } finally {
      endBatch();
    }
    if (openCard && !addAnother) {
      setSelectedCard(
        createCard({
          ...data,
          id,
          columnId: "shoot",
          status: "To Create",
          shootDuration: 45,
        }),
      );
    }
    return id;
  };

  const scheduleVaultIdeaOnShoot = useCallback(
    (idea, { client, shootDate, shootTime = "", shootEndTime = "" }) => {
      if (!idea || !client || !shootDate) return;
      beginBatch();
      try {
        ensurePlan(client, shootDate);
        const boardCardId = createCardFromIdea({
          ...idea,
          clientComment: idea.clientComment || "",
        });
        updateCard(boardCardId, {
          shootDate,
          shootTime,
          shootEndTime,
          columnId: "shoot",
          status: "To Create",
        });
        updateIdea(idea.id, { boardCardId });
      } finally {
        endBatch();
      }
    },
    [createCardFromIdea, ensurePlan, updateCard, updateIdea],
  );

  const handleScheduleVaultIdea = useCallback(
    (ideaId, schedule) => {
      const idea = ideas.find((entry) => entry.id === ideaId);
      if (!idea) return;
      scheduleVaultIdeaOnShoot(idea, schedule);
    },
    [ideas, scheduleVaultIdeaOnShoot],
  );

  const handleDeleteVaultIdea = useCallback(
    (ideaId) => {
      const idea = ideas.find((entry) => entry.id === ideaId);
      if (!idea) return;
      beginBatch();
      try {
        const linkedCard = findIdeaBoardCard(idea, cards);
        if (linkedCard) deleteCard(linkedCard.id);
        deleteIdea(ideaId);
      } finally {
        endBatch();
      }
    },
    [ideas, cards, deleteCard, deleteIdea],
  );

  const handleReturnCardToVault = useCallback(
    (card) => {
      if (!canReturnCardToVault(card)) return;
      const idea = ideas.find((entry) => entry.id === card.sourceIdeaId);
      const label = idea?.title || card.title || "this reel";
      if (
        !window.confirm(
          `Return "${label}" to the idea bank? It will be removed from the shoot and can be scheduled again later.`,
        )
      ) {
        return;
      }
      beginBatch();
      try {
        deleteCard(card.id);
        if (idea) updateIdea(idea.id, { boardCardId: null });
        if (selectedCard?.id === card.id) setSelectedCard(null);
      } finally {
        endBatch();
      }
    },
    [ideas, deleteCard, updateIdea, selectedCard?.id],
  );

  const handleAssignToShoot = useCallback(
    ({ cardIds = [], ideaIds = [], client, shootDate, shootTime = "", shootEndTime = "" }) => {
      beginBatch();
      try {
        ensurePlan(client, shootDate);
        for (const id of cardIds) {
          const existing = cards.find((entry) => entry.id === id);
          updateCard(id, {
            shootDate,
            shootTime: existing?.shootTime || shootTime || "",
            shootEndTime: existing?.shootEndTime || shootEndTime || "",
          });
        }
        for (const ideaId of ideaIds) {
          const idea = ideas.find((entry) => entry.id === ideaId);
          if (!idea) continue;
          scheduleVaultIdeaOnShoot(idea, { client, shootDate, shootTime, shootEndTime });
        }
      } finally {
        endBatch();
      }
    },
    [cards, ideas, ensurePlan, scheduleVaultIdeaOnShoot, updateCard],
  );

  const vaultIdeas = useMemo(
    () => getVaultIdeas(ideas, cards, { client: clientFilter }),
    [ideas, cards, clientFilter],
  );

  const openAddCardsToShoot = useCallback((client, shootDate, { excludeCardIds = [], shootTime = '', shootEndTime = '' } = {}) => {
    if (!client || !shootDate) return;
    setAssignToShoot({ client, shootDate, excludeCardIds, shootTime, shootEndTime });
  }, []);

  const handleRemoveFromShootSchedule = (card) => {
    if (
      !window.confirm(
        `Remove "${card.title}" from this shoot? The card will stay on the board without a shoot date.`,
      )
    ) {
      return;
    }
    const clears = { shootDate: '', shootTime: '', shootEndTime: '' };
    if (card.isOneOffProject || card.contentType === 'One-off Project') {
      clears.dueDate = '';
      clears.dueTime = '';
    }
    updateCard(card.id, clears);
    setSelectedCard((prev) =>
      prev?.id === card.id ? { ...prev, ...clears } : prev,
    );
  };

  const handleRemoveClientShoot = (client, dateKey, clientCards) => {
    const count = clientCards.length;
    const message = count
      ? `Delete ${client}'s shoot on this day? ${count} item${count === 1 ? '' : 's'} will stay on the board but lose their shoot date.`
      : `Delete ${client}'s shoot on this day?`;
    if (!window.confirm(message)) return;

    beginBatch();
    try {
      for (const card of clientCards) {
        const clears = { shootDate: '', shootTime: '', shootEndTime: '' };
        if (card.isOneOffProject || card.contentType === 'One-off Project') {
          clears.dueDate = '';
          clears.dueTime = '';
        }
        updateCard(card.id, clears);
      }
      deletePlan(client, dateKey);
    } finally {
      endBatch();
    }
    setSelectedCard((prev) =>
      prev?.client === client && prev?.shootDate === dateKey
        ? { ...prev, shootDate: "", shootTime: "", shootEndTime: "" }
        : prev,
    );
  };

  const handleMoveClientShootDay = useCallback(
    (client, fromDateKey, toDateKey) => {
      if (!client || !fromDateKey || !toDateKey || fromDateKey === toDateKey) return;

      beginBatch();
      try {
        cards
          .filter(
            (card) =>
              card.client === client &&
              card.shootDate === fromDateKey &&
              card.contentType !== "Story",
          )
          .forEach((card) => {
            updateCard(card.id, { shootDate: toDateKey });
          });

        const oldPlan = getPlan(client, fromDateKey);
        const hadShootContent =
          oldPlan.manual ||
          cards.some(
            (card) =>
              card.client === client &&
              card.shootDate === fromDateKey &&
              card.contentType !== "Story",
          );

        if (hadShootContent) {
          updatePlan(client, toDateKey, {
            title: oldPlan.title || "",
            location: oldPlan.location || "",
            callTime: oldPlan.callTime || "",
            shootStartTime: oldPlan.shootStartTime || "",
            shootEndTime: oldPlan.shootEndTime || "",
            sessionModels: oldPlan.sessionModels || "",
            sessionNeeds: oldPlan.sessionNeeds || "",
            notes: oldPlan.notes || "",
            manual: true,
          });
          deletePlan(client, fromDateKey);
        }
      } finally {
        endBatch();
      }

      setSelectedCard((prev) => {
        if (!prev || prev.client !== client || prev.shootDate !== fromDateKey) return prev;
        return { ...prev, shootDate: toDateKey };
      });

      setShootFocus({ dateKey: toDateKey, client, token: Date.now() });
    },
    [cards, updateCard, getPlan, updatePlan, deletePlan],
  );

  const handleUpdate = (id, updates, options = {}) => {
    updateCard(id, updates, options);
    // Typing commits use local draft state in CardModal — skip shell re-render until undo-worthy edits.
    if (options.recordUndo !== false) {
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
    }

    if (updates.shootDate !== undefined && activeView === "shoot") {
      const card = cards.find((entry) => entry.id === id);
      if (card?.client && updates.shootDate) {
        setShootFocus({
          dateKey: updates.shootDate,
          client: card.client,
          token: Date.now(),
        });
      }
    }
  };

  const handleDelete = (id) => {
    deleteCard(id);
    if (selectedCard?.id === id) setSelectedCard(null);
  };

  const handleApproveIdea = (ideaId, clientComment) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea || idea.status !== "pending") return;
    markApproved(ideaId, clientComment, null);
  };

  const handleDeclineIdea = (ideaId, clientComment) => {
    markDeclined(ideaId, clientComment);
  };

  const handlePortalApprove = (ideaId, clientComment, ideaSnapshot) => {
    const idea = ideas.find((i) => i.id === ideaId) || ideaSnapshot;
    if (!idea) return;
    if (ideas.some((i) => i.id === ideaId && i.status === "approved")) return;
    if (ideas.some((i) => i.id === ideaId && i.status !== "pending")) return;
    beginBatch();
    try {
      if (!ideas.some((i) => i.id === ideaId)) {
        addIdea(idea);
      }
      markApproved(ideaId, clientComment, null);
    } finally {
      endBatch();
    }
  };

  const handlePortalDecline = (ideaId, clientComment, ideaSnapshot) => {
    beginBatch();
    try {
      if (!ideas.some((i) => i.id === ideaId)) {
        addIdea(ideaSnapshot);
      }
      markDeclined(ideaId, clientComment);
    } finally {
      endBatch();
    }
  };

  const handleApplyClientResponses = () => {
    const responses = loadClientResponses();
    if (!responses.length) return;
    beginBatch();
    let applied;
    try {
      applied = applyClientResponses(ideas, responses, {
        markApproved,
        markDeclined,
        ensureIdeaExists: () => {},
        createCardFromIdea,
        addIdea,
      });
    } finally {
      endBatch();
    }
    setResponseCount(0);
    alert(`Applied ${applied} client response${applied === 1 ? "" : "s"} to the idea bank.`);
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
    beginBatch();
    let applied;
    try {
      applied = applyContentReviewResponses(cards, responses, { updateCard });
    } finally {
      endBatch();
    }
    setContentReviewResponseCount(0);
    alert(`Applied ${applied} content review response${applied === 1 ? "" : "s"} to the board.`);
  };

  const handleApplyShootResponses = () => {
    const responses = loadShootResponses();
    if (!responses.length) return;
    beginBatch();
    let applied = 0;
    try {
      for (const submission of responses) {
        applied += applyShootSubmission(submission, cards, { updateCard, updatePlan });
      }
    } finally {
      endBatch();
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
      runWithoutUndoCapture(() => {
        const contentResponses = loadContentReviewResponses();
        if (contentResponses.length) {
          applyContentReviewResponses(cards, contentResponses, { updateCard });
        }

        const ideaResponses = SUPABASE_ENABLED ? [] : loadClientResponses();
        if (ideaResponses.length) {
          applyClientResponses(ideas, ideaResponses, {
            markApproved,
            markDeclined,
            ensureIdeaExists: () => {},
            createCardFromIdea,
            addIdea,
          });
        }

        const shootResponses = loadShootResponses();
        if (shootResponses.length) {
          let applied = 0;
          for (const submission of shootResponses) {
            applied += applyShootSubmission(submission, cards, { updateCard, updatePlan });
          }
          if (applied > 0) clearShootResponses();
        }
      });
      setContentReviewResponseCount(loadContentReviewResponses().length);
      setResponseCount(loadClientResponses().length);
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

  // Supabase client portal approvals land on the idea record only — staff schedules from the idea bank.

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
      alert(`Imported ${applied} client approval${applied === 1 ? "" : "s"} to the idea bank.`);
      setActiveView("ideas");
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

  const syncTotal = responseCount + contentReviewResponseCount + shootResponseCount;
  const agencyOps = isSharedOperationsLogin(session);
  const staffDisplayName = resolveStaffDisplayName(session, teamMembers, org?.name);
  const staffAvatar = resolveStaffMemberAvatar(session, teamMembers);
  const {
    staffName,
    myWorkOnly,
    companyWideView,
    personalTaskScope,
    visibleCompanyTaskTabs,
    clientAccountManagers: scopeClientAccountManagers,
  } = useStaffWorkspaceScope();
  const workspaceCards = useMemo(
    () =>
      scopeCardsForStaff(cards, {
        clientFilter,
        personalTaskScope,
        staffName,
        clientAccountManagers: scopeClientAccountManagers,
      }),
    [cards, clientFilter, personalTaskScope, staffName, scopeClientAccountManagers],
  );
  const workspaceAdminTasks = useMemo(
    () =>
      scopeAdminTasksForStaff(adminTasks, {
        clientFilter,
        personalTaskScope,
        staffName,
      }),
    [adminTasks, clientFilter, personalTaskScope, staffName],
  );
  const showAccountManagerQueue = agencyOps || !myWorkOnly
    ? true
    : staffHasAccountManagerQueueAccess(session, teamMembers) || companyWideView;
  const workspaceAlerts = useMemo(
    () =>
      buildWorkspaceAlerts({
        cards,
        ideas,
        clientFilter,
        staffName,
        clientAccountManagers: scopeClientAccountManagers,
        personalTaskScope,
      }),
    [cards, ideas, clientFilter, staffName, scopeClientAccountManagers, personalTaskScope],
  );
  const notificationCount = syncTotal + workspaceAlerts.length;

  // Show overview as soon as cached cards exist; only block when we have no data yet.
  const workspaceDataLoading =
    SUPABASE_ENABLED && !orgReady && cards.length === 0 && !cardsSyncLoaded;

  const navBadges = useMemo(() => {
    const summary = buildWorkspaceHomeSummary({
      cards,
      ideas,
      adminTasks: workspaceAdminTasks,
      clientFilter: 'all',
      syncTotal,
      staffName,
      clientAccountManagers,
      myWorkOnly,
      companyWideView,
      showAccountManagerQueue,
    });
    return buildNavBadgeCounts(
      summary,
      syncTotal,
      personalTaskScope ? visibleCompanyTaskTabs : null,
    );
  }, [
    cards,
    ideas,
    workspaceAdminTasks,
    syncTotal,
    staffName,
    clientAccountManagers,
    myWorkOnly,
    companyWideView,
    showAccountManagerQueue,
    personalTaskScope,
    visibleCompanyTaskTabs,
  ]);

  useEffect(() => {
    if (clientFilter === "all" && activeView === "client-files") {
      setActiveView("home");
    }
  }, [clientFilter, activeView]);

  if (authRequired && !ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-black"
        style={{ color: 'rgba(255,255,255,0.75)' }}
      >
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

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
        onUpdatePlan={(updates, options) => updatePlan(shootPortal.client, shootPortal.dateKey, updates, options)}
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
        onAddIdea={addIdea}
        onApprove={(id, comment, idea) => handlePortalApprove(id, comment, idea)}
        onDecline={(id, comment, idea) => {
          const snap = idea || ideas.find((i) => i.id === id);
          handlePortalDecline(id, comment, snap);
        }}
      />
    );
  }

  const handleSignOut = () => {
    logout();
    onSignOut?.();
  };

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
      profileLabel={staffDisplayName || 'Staff'}
      profileLogo={staffAvatar}
      onSignOut={onSignOut ? handleSignOut : undefined}
      clientFilter={clientFilter}
      onClientChange={setClientFilter}
      homeNavLabel={companyWideView && myWorkOnly ? 'Overview' : myWorkOnly ? 'My work' : 'Overview'}
      navBadges={navBadges}
      canUndo={canUndo}
      onUndo={undo}
    >
      {activeView === "home" && (
        <WorkspaceHomePage
          cards={cards}
          ideas={ideas}
          adminTasks={workspaceAdminTasks}
          meetings={meetings}
          plans={plans}
          getPlan={getPlan}
          clientFilter={clientFilter}
          syncTotal={syncTotal}
          staffName={staffName}
          clientAccountManagers={clientAccountManagers}
          myWorkOnly={myWorkOnly}
          companyWideView={companyWideView}
          showAccountManagerQueue={showAccountManagerQueue}
          workspaceDataLoading={workspaceDataLoading}
          onNavigate={handleNavigate}
          onOpenMeeting={(meeting) =>
            handleNavigate('calendars', { calendarsTab: 'meetings', openMeeting: meeting })
          }
          onOpenShoot={(shootDay) =>
            handleNavigate('shoot', { shootDate: shootDay.dateKey, shootClient: shootDay.client })
          }
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
      )}

      {activeView === "ideas" && (
        <VideoIdeas
          ideas={ideas}
          cards={cards}
          clientFilter={clientFilter}
          onAddIdea={addIdea}
          onApprove={handleApproveIdea}
          onDecline={handleDeclineIdea}
          onDeleteIdea={deleteIdea}
          onDeleteIdeas={deleteIdeas}
          onDeleteVaultIdea={handleDeleteVaultIdea}
          onUpdateIdea={updateIdea}
          onGoToBoard={handleGoToBoard}
          onScheduleVaultIdea={handleScheduleVaultIdea}
        />
      )}

      {activeView === "board" && (
        <section>
          <KanbanBoard
            cards={cards}
            onAddCard={(columnId, { client } = {}) => {
              const resolvedClient = client ?? (clientFilter !== 'all' ? clientFilter : undefined);
              const newCard = addCard(columnId, { client: resolvedClient });
              if (newCard) setSelectedCard(newCard);
            }}
            onCardClick={handleCardClick}
            onDeleteCard={handleDelete}
            onReturnToVault={handleReturnCardToVault}
            onMoveCard={handleMoveCard}
            clientFilter={clientFilter}
            getClientColor={getClientColor}
            embedded
          />
        </section>
      )}

      {activeView === "calendars" && (
        <UnifiedCalendarsPage
          cards={cards}
          events={events}
          meetings={meetings}
          clientFilter={clientFilter}
          getPlan={getPlan}
          initialTab={calendarsTab}
          openMeetingRequest={openMeetingRequest}
          onOpenMeetingRequestHandled={() => setOpenMeetingRequest(null)}
          onNavigate={handleNavigate}
          onTabChange={setCalendarsTab}
          onCardClick={handleCardClick}
          onShootSessionClick={(session) =>
            handleNavigate('shoot', {
              shootDate: session.dueDate,
              shootClient: session.client,
            })
          }
          onAddCalendarPost={handleAddCalendarPost}
          onRemoveFromCalendar={handleRemoveFromCalendar}
          onMoveCalendarPost={handleMoveCalendarPost}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onAddMeeting={addMeeting}
          onUpdateMeeting={updateMeeting}
          onDeleteMeeting={deleteMeeting}
        />
      )}

      {activeView === "todo" && (
        <CompanyTasks
          cards={cards}
          adminTasks={workspaceAdminTasks}
          clientFilter={clientFilter}
          embedded
          initialRole={tasksRole}
          onRoleChange={setTasksRole}
          onAddOneOffTask={addOneOffProject}
          onDeleteOneOffTask={handleDeleteOneOffProject}
          onAddAdminTask={addAdminTask}
          onToggleAdminTaskComplete={toggleAdminTaskComplete}
          onDeleteAdminTask={deleteAdminTask}
          onOpenCard={handleCardClick}
          onUpdateCard={updateCard}
          onMarkScheduled={handleMarkScheduled}
          onMarkPosted={handleMarkPosted}
          onSubmitForReview={handleSubmitForReview}
          onApproveReview={handleApproveReview}
          onSendBackForEditing={handleSendBackForEditing}
          onMoveTask={handleMoveEditorTask}
          onHandoff={handleHandoffRequest}
          onNavigate={handleNavigate}
          onPlanPostDate={setPlanDateCard}
        />
      )}

      {activeView === "shoot" && (
        <ShootDay
          cards={cards}
          clientFilter={clientFilter}
          plans={plans}
          focusRequest={shootFocus}
          onMoveClientShootDay={handleMoveClientShootDay}
          onNavigate={handleNavigate}
          onCardClick={handleCardClick}
          onUpdateCard={updateCard}
          onAddShootItem={handleAddShootItem}
          onAssignExistingToShoot={handleAssignExistingToShoot}
          onAddCardsToShoot={openAddCardsToShoot}
          getPlan={getPlan}
          onUpdatePlan={updatePlan}
          onEnsurePlan={ensurePlan}
          onRemoveFromSchedule={handleRemoveFromShootSchedule}
          onReturnToVault={handleReturnCardToVault}
          onRemoveClientShoot={handleRemoveClientShoot}
          embedded
        />
      )}

      {activeView === "client-files" && clientFilter !== "all" && (
        <ClientFilesWorkspacePage client={clientFilter} />
      )}

      {activeView === "clients" && (
        <ClientManagementPage
          cards={cards}
          ideas={ideas}
          initialTab={clientsTab}
          onTabChange={setClientsTab}
        />
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
          cards={cards}
          plans={plans}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onPlanPostDate={setPlanDateCard}
          onPlanShootDate={setShootDateCard}
          onAddCardsToShoot={openAddCardsToShoot}
          onOpenCard={handleCardClick}
          onReturnToVault={handleReturnCardToVault}
        />
      )}

      {planDateCard && (
        <PlanPostDateModal
          card={planDateCard}
          cards={cards}
          onClose={() => setPlanDateCard(null)}
          onSave={(cardId, updates) => updateCard(cardId, updates)}
          onOpenCard={handleCardClick}
        />
      )}

      {shootDateCard && (
        <PlanShootDateModal
          card={shootDateCard}
          cards={cards}
          plans={plans}
          getPlan={getPlan}
          onClose={() => setShootDateCard(null)}
          onSave={(cardId, updates) => {
            beginBatch();
            try {
              updateCard(cardId, updates);
              if (updates.shootDate) {
                ensurePlan(shootDateCard.client, updates.shootDate);
              }
            } finally {
              endBatch();
            }
          }}
          onOpenCard={handleCardClick}
          onAddItemToDay={(client, shootDate) => {
            setQuickAddShootItem({ client, shootDate });
          }}
          onAddCardsToShoot={(client, shootDate, options) =>
            openAddCardsToShoot(client, shootDate, {
              excludeCardIds: [shootDateCard.id, ...(options?.excludeCardIds || [])],
              shootTime: options?.shootTime || '',
              shootEndTime: options?.shootEndTime || '',
            })
          }
        />
      )}

      {assignToShoot && (
        <AddExistingToShootModal
          cards={cards}
          vaultIdeas={vaultIdeas}
          client={assignToShoot.client}
          dateKey={assignToShoot.shootDate}
          shootTime={assignToShoot.shootTime}
          shootEndTime={assignToShoot.shootEndTime}
          excludeCardIds={assignToShoot.excludeCardIds}
          onClose={() => setAssignToShoot(null)}
          onAssign={(payload) => {
            handleAssignToShoot(payload);
            setAssignToShoot(null);
          }}
        />
      )}

      {quickAddShootItem && (
        <AddShootDayModal
          mode="item"
          defaultDate={quickAddShootItem.shootDate}
          defaultClient={quickAddShootItem.client}
          lockClient
          lockDate
          onClose={() => setQuickAddShootItem(null)}
          onAddDay={() => {}}
          onAddItem={(data, options) => {
            handleAddShootItem(data, { addAnother: options?.addAnother });
            if (!options?.addAnother) {
              setQuickAddShootItem(null);
            }
          }}
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
