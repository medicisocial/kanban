import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_TEAM_MEMBERS, TEAM_ROLES, TEAM_STORAGE_KEY } from '../constants';
import {
  getAllMemberNames,
  getMemberNamesByRole,
  memberMatchesRole,
  mergeTeamMemberUpdates,
  normalizeTeamMember,
} from '../utils/teamMembers';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

const getTeamMemberId = (member) => member.id;

function loadTeamMembers() {
  try {
    const parsed = readOrgScopedJson(TEAM_STORAGE_KEY, null);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((member) => normalizeTeamMember(member)).filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_TEAM_MEMBERS.map((member) => normalizeTeamMember(member)).filter(Boolean);
}

export function useTeamMembers() {
  const [teamMembers, setTeamMembers] = useState(() =>
    initialSyncCollectionState(loadTeamMembers, { table: 'team_members', getId: getTeamMemberId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setTeamMembers(loadTeamMembers());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'team_members',
    items: teamMembers,
    setItems: setTeamMembers,
    getId: getTeamMemberId,
    normalize: normalizeTeamMember,
    loadLocal: loadTeamMembers,
  });

  // Keep localStorage as a write-through cache even when Supabase is enabled, so
  // team-member logins keep working: verifyTeamMemberStaffCredentials() reads
  // localStorage directly, and the /api/team-auth endpoint reads the KV blob fed
  // from it. Supabase realtime updates flow into state -> here -> localStorage.
  // Debounce writes to avoid thrashing during rapid edits.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(TEAM_STORAGE_KEY, teamMembers);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [teamMembers, syncLoaded]);

  const getMembersByRole = useCallback(
    (role) => teamMembers.filter((member) => memberMatchesRole(member, role)),
    [teamMembers],
  );

  const getMemberNamesForRole = useCallback(
    (role) => getMemberNamesByRole(teamMembers, role),
    [teamMembers],
  );

  const getAllTeamMemberNames = useCallback(
    () => getAllMemberNames(teamMembers),
    [teamMembers],
  );

  const addTeamMember = useCallback((name, roles = []) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Enter a team member name.' };

    const normalizedRoles = roles.filter((role) => TEAM_ROLES.includes(role));
    if (normalizedRoles.length === 0) {
      return { ok: false, error: 'Select at least one role.' };
    }

    let addedId = null;
    let addedMember = null;
    setTeamMembers((prev) => {
      if (prev.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      addedId = crypto.randomUUID();
      addedMember = normalizeTeamMember({ id: addedId, name: trimmed, roles: normalizedRoles });
      return [...prev, addedMember];
    });

    if (!addedId) {
      return { ok: false, error: 'A team member with that name already exists.' };
    }
    return { ok: true, id: addedId, member: addedMember };
  }, []);

  const updateTeamMember = useCallback((id, updates) => {
    let persisted = null;
    setTeamMembers((prev) =>
      prev.map((member) => {
        if (member.id !== id) return member;
        persisted = { ...mergeTeamMemberUpdates(member, updates), updatedAt: Date.now() };
        return persisted;
      }),
    );
    return persisted;
  }, []);

  const saveTeamMemberToCloud = useCallback(async (member) => {
    if (!member) return { ok: false, error: 'Nothing to save.' };
    // useCollectionSync pushes cloud writes; local state was already updated.
    return { ok: true };
  }, []);

  const removeTeamMember = useCallback((id) => {
    tombstoneSyncedDeletes('team_members', [id]);
    setTeamMembers((prev) => prev.filter((member) => member.id !== id));
  }, []);

  const toggleTeamMemberRole = useCallback((id, role) => {
    if (!TEAM_ROLES.includes(role)) return;
    setTeamMembers((prev) =>
      prev.map((member) => {
        if (member.id !== id) return member;
        const hasRole = member.roles.includes(role);
        const roles = hasRole ? member.roles.filter((r) => r !== role) : [...member.roles, role];
        return { ...member, roles };
      }),
    );
  }, []);

  return {
    teamMembers,
    teamRoles: TEAM_ROLES,
    getMembersByRole,
    getMemberNamesForRole,
    getAllTeamMemberNames,
    addTeamMember,
    updateTeamMember,
    saveTeamMemberToCloud,
    removeTeamMember,
    toggleTeamMemberRole,
  };
}
