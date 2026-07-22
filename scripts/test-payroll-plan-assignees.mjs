import assert from 'node:assert/strict';
import { ensurePlanAssigneesOnStaffList } from '../src/utils/payrollPlanAssignees.js';

function createStaff(overrides = {}) {
  const kind = overrides.kind === 'team' ? 'team' : 'custom';
  return {
    id: overrides.id || `id-${overrides.name || 'x'}`,
    name: String(overrides.name || '').trim(),
    kind,
    teamMemberId: kind === 'team' ? overrides.teamMemberId || null : null,
    extraFields: Array.isArray(overrides.extraFields) ? overrides.extraFields : [],
  };
}

// --- Scenario 1: plan assignee not yet on payroll → added as kind team ---
{
  const { staff, changed } = ensurePlanAssigneesOnStaffList(
    [{ id: '1', name: 'Valerie Landeros', kind: 'team', teamMemberId: 'v1', extraFields: [] }],
    [{ name: 'Jeslyn Example', teamMemberId: 'j1' }],
    createStaff,
  );
  assert.equal(changed, true);
  assert.equal(staff.length, 2);
  const jeslyn = staff.find((p) => p.name === 'Jeslyn Example');
  assert.ok(jeslyn);
  assert.equal(jeslyn.kind, 'team');
  assert.equal(jeslyn.teamMemberId, 'j1');
}

// Name-only fallback when no teamMemberId
{
  const { staff, changed } = ensurePlanAssigneesOnStaffList(
    [],
    [{ name: 'Jeslyn Example', teamMemberId: null }],
    createStaff,
  );
  assert.equal(changed, true);
  assert.equal(staff[0].kind, 'team');
  assert.equal(staff[0].teamMemberId, null);
  assert.equal(staff[0].name, 'Jeslyn Example');
}

// --- Scenario 2: existing custom row with same name → upgraded to team ---
{
  const { staff, changed } = ensurePlanAssigneesOnStaffList(
    [
      {
        id: 'custom-1',
        name: 'Jeslyn Example',
        kind: 'custom',
        teamMemberId: null,
        extraFields: [{ id: 'e1', label: 'Pay', amount: 50 }],
      },
    ],
    [{ name: 'Jeslyn Example', teamMemberId: 'j1' }],
    createStaff,
  );
  assert.equal(changed, true);
  assert.equal(staff.length, 1);
  assert.equal(staff[0].id, 'custom-1');
  assert.equal(staff[0].kind, 'team');
  assert.equal(staff[0].teamMemberId, 'j1');
  assert.equal(staff[0].extraFields[0].amount, 50);
}

// Already team → no-op (terminates effect loops)
{
  const existing = [
    { id: '1', name: 'Jeslyn Example', kind: 'team', teamMemberId: 'j1', extraFields: [] },
  ];
  const { staff, changed } = ensurePlanAssigneesOnStaffList(
    existing,
    [{ name: 'Jeslyn Example', teamMemberId: 'j1' }],
    createStaff,
  );
  assert.equal(changed, false);
  assert.equal(staff.length, 1);
  assert.equal(staff[0].kind, 'team');
  assert.equal(staff[0].teamMemberId, 'j1');
}

// Duplicate names on roster: only the first match is upgraded; no second row added
{
  const { staff, changed } = ensurePlanAssigneesOnStaffList(
    [
      { id: 'a', name: 'Alex', kind: 'custom', teamMemberId: null, extraFields: [] },
      { id: 'b', name: 'Alex', kind: 'custom', teamMemberId: null, extraFields: [] },
    ],
    [{ name: 'Alex', teamMemberId: 't1' }],
    createStaff,
  );
  assert.equal(changed, true);
  assert.equal(staff.length, 2);
  assert.equal(staff[0].kind, 'team');
  assert.equal(staff[0].teamMemberId, 't1');
  assert.equal(staff[1].kind, 'custom');
  assert.equal(staff[1].teamMemberId, null);
}

console.log('test-payroll-plan-assignees: ok');
