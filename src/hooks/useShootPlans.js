import { useState, useEffect, useCallback } from "react";
import { SHOOT_PLANS_STORAGE_KEY } from "../constants";
import { getShootPlanKey } from "../utils/shootDay";

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

  const updatePlan = useCallback((client, dateKey, updates) => {
    const key = getShootPlanKey(client, dateKey);
    setPlans((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || createPlan(client, dateKey)),
        ...updates,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const ensurePlan = useCallback((client, dateKey) => {
    const key = getShootPlanKey(client, dateKey);
    setPlans((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || createPlan(client, dateKey)),
        manual: true,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const deletePlan = useCallback((client, dateKey) => {
    const key = getShootPlanKey(client, dateKey);
    setPlans((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return { plans, getPlan, updatePlan, ensurePlan, deletePlan };
}
