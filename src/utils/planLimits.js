import { getPlan, normalizePlanType } from '../constants/plans';

export function getPlanLimits(planType) {
  const plan = getPlan(planType);
  return {
    maxClients: plan.maxClients,
    maxTeamSeats: plan.maxTeamSeats,
    label: plan.label,
    clientPortal: plan.clientPortal,
  };
}

export function canAddClient(planType, currentClientCount) {
  const { maxClients } = getPlanLimits(planType);
  return currentClientCount < maxClients;
}

export function canAddTeamMember(planType, currentSeatCount) {
  const { maxTeamSeats } = getPlanLimits(planType);
  return currentSeatCount < maxTeamSeats;
}

export function hasFullClientPortal(planType) {
  return getPlanLimits(planType).clientPortal === 'full';
}

export { normalizePlanType };
