import { ORG_ID as DEFAULT_ORG_ID } from './supabaseClient';

/** Default legacy org — Medici Social production workspace. */
export const LEGACY_ORG_ID = DEFAULT_ORG_ID;

let activeOrgId = DEFAULT_ORG_ID;
let orgReady = true;

export function setOrgSession(orgId, ready = true) {
  activeOrgId = orgId || DEFAULT_ORG_ID;
  orgReady = ready;
}

export function getOrgId() {
  return activeOrgId || DEFAULT_ORG_ID;
}

export function isOrgReady() {
  return orgReady;
}

export function resetOrgSession() {
  activeOrgId = DEFAULT_ORG_ID;
  orgReady = true;
}
