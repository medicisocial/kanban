/**
 * Awaitable team-member cloud save. Team Management must not show "saved"
 * until /api/staff-sync confirms the write — especially when a plaintext
 * password is in the payload for staff_accounts hashing.
 */

export const TEAM_MEMBER_CLOUD_SAVE_ERROR =
  'Could not save team member to the cloud. Stay signed in and try again.';

/**
 * Push one team member through staff-sync and report whether plaintext
 * should be scrubbed from memory (only after a confirmed success).
 *
 * @param {object|null|undefined} member
 * @param {{
 *   pushFn: (args: object) => Promise<boolean>,
 *   isCloudEnabled: () => boolean,
 *   getOrgId: () => string,
 * }} deps
 */
export async function saveTeamMemberToCloud(member, deps) {
  if (!member) {
    return { ok: false, error: 'Nothing to save.', shouldScrubPassword: false };
  }

  const hasPlainPassword = Boolean(String(member.password || '').trim());

  if (!deps.isCloudEnabled()) {
    return { ok: true, shouldScrubPassword: hasPlainPassword };
  }

  const ok = await deps.pushFn({
    table: 'team_members',
    changed: [member],
    removed: [],
    orgId: deps.getOrgId(),
  });

  if (!ok) {
    return {
      ok: false,
      error: TEAM_MEMBER_CLOUD_SAVE_ERROR,
      shouldScrubPassword: false,
    };
  }

  return { ok: true, shouldScrubPassword: hasPlainPassword };
}

/**
 * Map a cloud-save result to what Team Management / the detail card should show.
 * Failed pushes never produce a success toast.
 */
export function teamMemberSaveUiState(cloudResult) {
  if (!cloudResult?.ok) {
    return {
      ok: false,
      error: cloudResult?.error || TEAM_MEMBER_CLOUD_SAVE_ERROR,
      successMessage: null,
    };
  }
  return {
    ok: true,
    error: null,
    successMessage: 'Team member saved.',
  };
}
