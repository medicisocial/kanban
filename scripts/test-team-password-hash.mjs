/**
 * Unit tests for team password hashing (bcrypt) and team-auth hardening.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, looksLikeBcryptHash, verifyPasswordHash } from '../api/_lib/passwordHash.mjs';
import { verifyTeamMemberPassword } from '../api/_lib/teamAuth.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const hash = await hashPassword('correct-horse');
assert.equal(looksLikeBcryptHash(hash), true);
assert.equal(await verifyPasswordHash(hash, 'correct-horse'), true);
assert.equal(await verifyPasswordHash(hash, 'wrong'), false);
assert.equal(await verifyPasswordHash('plaintext', 'plaintext'), false, 'must not accept plaintext equality');
assert.equal(await verifyPasswordHash('', 'x'), false);

assert.equal(await verifyTeamMemberPassword({ passwordHash: hash }, 'correct-horse'), true);
assert.equal(await verifyTeamMemberPassword({ passwordHash: hash }, 'nope'), false);
assert.equal(await verifyTeamMemberPassword({ password: 'correct-horse' }, 'correct-horse'), false);

const teamAuthSource = readFileSync(resolve(root, 'api/team-auth.js'), 'utf8');
assert.match(teamAuthSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(teamAuthSource, /resolveAuthReadKey/);
assert.match(teamAuthSource, /password_hash/);
assert.doesNotMatch(teamAuthSource, /select=[^`]*\bpassword\b(?!_hash)/);

const teamMembersSource = readFileSync(resolve(root, 'src/utils/teamMembers.js'), 'utf8');
assert.match(teamMembersSource, /scrubTeamMemberSecrets/);
assert.match(teamMembersSource, /hasPassword/);

const detailCard = readFileSync(resolve(root, 'src/components/TeamMemberDetailCard.jsx'), 'utf8');
assert.match(detailCard, /Write-only/);
assert.doesNotMatch(detailCard, /password: member\.password/);

const migration = readFileSync(resolve(root, 'supabase/migrations/041_staff_password_hash.sql'), 'utf8');
assert.match(migration, /password_hash/);
assert.match(migration, /221c3dc0-128e-48e6-91b6-1d96bb766ecf/);
assert.match(migration, /team-valerie-landeros/);
assert.match(migration, /never store plaintext/);

const phase0 = readFileSync(resolve(root, 'supabase/migrations/040_revoke_team_members_anon_read.sql'), 'utf8');
assert.match(phase0, /team_members_anon_legacy_read/);

console.log('test-team-password-hash: ok');
