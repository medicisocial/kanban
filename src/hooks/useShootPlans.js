import { useState, useEffect, useCallback } from "react";
import { SHOOT_PLANS_STORAGE_KEY } from "../constants";
import { getShootPlanKey } from "../utils/shootDay";
import { notifyMutation } from "../utils/undoHistory";
import { useReloadFromStorage } from "./useReloadFromStorage";
import { SUPABASE_ENABLED } from "../lib/supabaseClient";
import { useMapSync } from "../lib/useMapSync";
import { pushStaffSyncRows } from "../lib/staffSyncApi";

function persistShootPlan(key, plan) {
  if (!SUPABASE_ENABLED || !key || !plan) return;
  void pushStaffSyncRows("shoot_plans", [{ id: key, data: plan }]);
}

function persistShootPlanDelete(key) {
  if (!SUPABASE_ENABLED || !key) return;
  void pushStaffSyncRows("shoot_plans", [], [key]);
}

function loadPlans() {
  try {
    const raw = localStorage.getItem(SHOOT_PLANS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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
  const [plans, setPlans] = useState(loadPlans);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setPlans(loadPlans());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useMapSync({
    table: 'shoot_plans',
    map: plans,
    setMap: setPlans,
    loadLocal: loadPlans,
  });

  useEffect(() => {
    localStorage.setItem(SHOOT_PLANS_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

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
    if (persisted) persistShootPlan(key, persisted);
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
    if (persisted) persistShootPlan(key, persisted);
  }, []);

  const deletePlan = useCallback((client, dateKey) => {
    notifyMutation();
    const key = getShootPlanKey(client, dateKey);
    setPlans((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    persistShootPlanDelete(key);
  }, []);

  return { plans, replacePlans, getPlan, updatePlan, ensurePlan, deletePlan };
}
