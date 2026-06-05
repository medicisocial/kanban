import { useState, useEffect, useCallback } from "react";
import { SHOOT_PLANS_STORAGE_KEY } from "../constants";
import { getShootPlanKey } from "../utils/shootDay";
import { notifyMutation } from "../utils/undoHistory";
import { useReloadFromStorage } from "./useReloadFromStorage";
import { SUPABASE_ENABLED } from "../lib/supabaseClient";
import { useMapSync } from "../lib/useMapSync";
import { initialSyncMapState, shouldPersistSyncedState, tombstoneSyncedDeletes } from "../lib/syncInitialState";
import { readOrgScopedJson, writeOrgScopedJson } from "../lib/orgStorage";

function loadPlans() {
  try {
    const raw = readOrgScopedJson(SHOOT_PLANS_STORAGE_KEY, null);
    if (raw && typeof raw === "object") return raw;
  } catch {
    /* ignore */
  }
  return {};
}

function createPlan(client, dateKey) {
  return {
    client,
    dateKey,
    manual: false,
    title: "",
    location: "",
    callTime: "",
    shootStartTime: "",
    shootEndTime: "",
    sessionModels: "",
    sessionNeeds: "",
    notes: "",
    updatedAt: Date.now(),
  };
}

export function useShootPlans() {
  const [plans, setPlans] = useState(() =>
    initialSyncMapState(loadPlans, { table: "shoot_plans" }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setPlans(loadPlans());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useMapSync({
    table: 'shoot_plans',
    map: plans,
    setMap: setPlans,
    loadLocal: loadPlans,
  });

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(SHOOT_PLANS_STORAGE_KEY, plans);
  }, [plans, syncLoaded]);

  const getPlan = useCallback(
    (client, dateKey) => {
      const key = getShootPlanKey(client, dateKey);
      return plans[key] || createPlan(client, dateKey);
    },
    [plans],
  );

  const replacePlans = useCallback((next) => {
    setPlans(next);
  }, []);

  const updatePlan = useCallback((client, dateKey, updates) => {
    notifyMutation();
    const key = getShootPlanKey(client, dateKey);
    let persisted = null;
    setPlans((prev) => {
      persisted = {
        ...(prev[key] || createPlan(client, dateKey)),
        ...updates,
        updatedAt: Date.now(),
      };
      return { ...prev, [key]: persisted };
    });
  }, []);

  const ensurePlan = useCallback((client, dateKey) => {
    notifyMutation();
    const key = getShootPlanKey(client, dateKey);
    let persisted = null;
    setPlans((prev) => {
      persisted = {
        ...(prev[key] || createPlan(client, dateKey)),
        manual: true,
        updatedAt: Date.now(),
      };
      return { ...prev, [key]: persisted };
    });
  }, []);

  const deletePlan = useCallback((client, dateKey) => {
    notifyMutation();
    const key = getShootPlanKey(client, dateKey);
    tombstoneSyncedDeletes("shoot_plans", [key]);
    setPlans((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return { plans, replacePlans, getPlan, updatePlan, ensurePlan, deletePlan };
}
