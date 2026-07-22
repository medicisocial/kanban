/**
 * Pure helpers for ensuring plan-pay assignees appear on a payroll staff list.
 * Name matching is case-insensitive; first match wins when duplicates exist.
 */

export function normalizePayrollNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Ensure each plan assignee is on the roster as kind: 'team'.
 * - Prefer upgrading an existing same-name row (custom → team).
 * - Otherwise append a new team row.
 * - Already-team same name: leave as-is (optionally fill teamMemberId).
 *
 * @returns {{ staff: array, changed: boolean }}
 */
export function ensurePlanAssigneesOnStaffList(staff = [], people = [], createStaff) {
  const next = Array.isArray(staff) ? [...staff] : [];
  let changed = false;

  for (const person of people || []) {
    const name = String(person?.name || '').trim();
    const nameKey = normalizePayrollNameKey(name);
    if (!nameKey) continue;

    const teamMemberId = person.teamMemberId || null;
    const idx = next.findIndex(
      (item) => normalizePayrollNameKey(item?.name) === nameKey,
    );

    if (idx >= 0) {
      const existing = next[idx];
      const needsKind = existing.kind !== 'team';
      const needsId =
        Boolean(teamMemberId) && existing.teamMemberId !== teamMemberId;
      if (!needsKind && !needsId) continue;
      next[idx] = createStaff({
        ...existing,
        name: existing.name || name,
        kind: 'team',
        teamMemberId: teamMemberId || existing.teamMemberId || null,
        extraFields: existing.extraFields,
        id: existing.id,
      });
      changed = true;
      continue;
    }

    next.push(
      createStaff({
        name,
        kind: 'team',
        teamMemberId,
        extraFields: [],
      }),
    );
    changed = true;
  }

  return { staff: next, changed };
}
