/**
 * Team Management cloud save must await staff-sync and never show a false "saved"
 * when the push fails — especially for password resets.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEAM_MEMBER_CLOUD_SAVE_ERROR,
  saveTeamMemberToCloud,
  teamMemberSaveUiState,
} from '../src/utils/teamMemberCloudSave.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const memberWithPassword = {
  id: '221c3dc0-128e-48e6-91b6-1d96bb766ecf',
  name: 'Jonathan Nguyễn',
  email: 'jonathan@medicisocial.com',
  username: 'jonathan@medicisocial.com',
  roles: ['Account Manager'],
  password: 'NewPassword-That-Must-Reach-Cloud',
  hasPassword: true,
};

// ── Failed staff-sync push → UI error, keep plaintext for retry ──────────────

let pushCalls = 0;
const failPush = async (args) => {
  pushCalls += 1;
  assert.equal(args.table, 'team_members');
  assert.equal(args.changed.length, 1);
  assert.equal(args.changed[0].password, memberWithPassword.password);
  return false;
};

const failed = await saveTeamMemberToCloud(memberWithPassword, {
  pushFn: failPush,
  isCloudEnabled: () => true,
  getOrgId: () => 'medici',
});

assert.equal(pushCalls, 1, 'must attempt staff-sync push');
assert.equal(failed.ok, false);
assert.equal(failed.shouldScrubPassword, false, 'must not scrub plaintext after a failed push');
assert.equal(failed.error, TEAM_MEMBER_CLOUD_SAVE_ERROR);

const failedUi = teamMemberSaveUiState(failed);
assert.equal(failedUi.ok, false);
assert.equal(failedUi.successMessage, null, 'failed push must not produce a success toast');
assert.equal(failedUi.error, TEAM_MEMBER_CLOUD_SAVE_ERROR);

// Simulate TeamMemberDetailCard / TeamManagementPage save outcome
function simulateTeamManagementSaveUi(cloudResult) {
  const ui = teamMemberSaveUiState(cloudResult);
  if (!ui.ok) {
    return {
      banner: 'error',
      text: ui.error,
      showSaved: false,
      clearPasswordField: false,
    };
  }
  return {
    banner: 'success',
    text: ui.successMessage,
    showSaved: true,
    clearPasswordField: true,
  };
}

const failedScreen = simulateTeamManagementSaveUi(failed);
assert.equal(failedScreen.showSaved, false);
assert.equal(failedScreen.banner, 'error');
assert.match(failedScreen.text, /cloud/i);
assert.equal(failedScreen.clearPasswordField, false);

// ── Successful push → scrub + "saved" ────────────────────────────────────────

const okPush = async () => true;
const saved = await saveTeamMemberToCloud(memberWithPassword, {
  pushFn: okPush,
  isCloudEnabled: () => true,
  getOrgId: () => 'medici',
});
assert.equal(saved.ok, true);
assert.equal(saved.shouldScrubPassword, true);

const savedUi = teamMemberSaveUiState(saved);
assert.equal(savedUi.ok, true);
assert.equal(savedUi.error, null);
assert.equal(savedUi.successMessage, 'Team member saved.');

const savedScreen = simulateTeamManagementSaveUi(saved);
assert.equal(savedScreen.showSaved, true);
assert.equal(savedScreen.banner, 'success');

// ── Local-only mode skips network but still allows scrub ─────────────────────

let localPushCalls = 0;
const local = await saveTeamMemberToCloud(memberWithPassword, {
  pushFn: async () => {
    localPushCalls += 1;
    return true;
  },
  isCloudEnabled: () => false,
  getOrgId: () => 'medici',
});
assert.equal(localPushCalls, 0);
assert.equal(local.ok, true);
assert.equal(local.shouldScrubPassword, true);

// ── Source wiring: hook awaits real push; no timer-based scrub ───────────────

const hookSource = readFileSync(resolve(root, 'src/hooks/useTeamMembers.js'), 'utf8');
assert.match(hookSource, /pushTeamMemberCloudSave|saveTeamMemberToCloud/);
assert.match(hookSource, /pushStaffSync/);
assert.match(hookSource, /shouldScrubPassword/);
assert.doesNotMatch(hookSource, /1200/);
assert.doesNotMatch(
  hookSource,
  /return \{ ok: true \};\s*\n\s*\}, \[\]\);/,
  'must not return unconditional ok:true',
);

const pageSource = readFileSync(resolve(root, 'src/components/TeamManagementPage.jsx'), 'utf8');
assert.match(pageSource, /teamMemberSaveUiState/);
assert.match(pageSource, /setError\(ui\.error\)/);

console.log('test-team-member-cloud-save: ok');
