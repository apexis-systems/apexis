import { organizations, plans, users } from "../models/index.ts";

export const SUBSCRIPTION_GRACE_DAYS = 4;

export interface SubscriptionAccessState {
  planEndDate: Date | null;
  graceEndDate: Date | null;
  isExpired: boolean;
  isInGracePeriod: boolean;
  isLocked: boolean;
  graceDaysRemaining: number;
}

export const getSubscriptionAccessState = (
  planEndDateInput: Date | string | null | undefined,
  now: Date = new Date(),
): SubscriptionAccessState => {
  if (!planEndDateInput) {
    return {
      planEndDate: null,
      graceEndDate: null,
      isExpired: false,
      isInGracePeriod: false,
      isLocked: false,
      graceDaysRemaining: SUBSCRIPTION_GRACE_DAYS,
    };
  }

  const planEndDate = new Date(planEndDateInput);
  const graceEndDate = new Date(planEndDate);
  graceEndDate.setDate(graceEndDate.getDate() + SUBSCRIPTION_GRACE_DAYS);

  const isExpired = now > planEndDate;
  const isLocked = now > graceEndDate;
  const isInGracePeriod = isExpired && !isLocked;

  const msRemaining = graceEndDate.getTime() - now.getTime();
  const graceDaysRemaining = Math.max(
    0,
    Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
  );

  return {
    planEndDate,
    graceEndDate,
    isExpired,
    isInGracePeriod,
    isLocked,
    graceDaysRemaining,
  };
};

export const getOrganizationWithPlan = async (organizationId: number) => {
  return organizations.findByPk(organizationId, {
    include: [{ model: plans }],
  });
};

export const checkMemberLimit = async (
  organizationId: number,
  role: "contributor" | "client",
) => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org || !org.plan) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization or Plan not found",
    };
  }

  const limit =
    role === "contributor" ? org.plan.contributor_limit : org.plan.client_limit;
  const currentUsage = await users.count({
    where: { organization_id: org.id, role },
  });

  if (currentUsage >= limit) {
    const roleLabel = role === "contributor" ? "Contributor" : "Client";
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `${roleLabel} limit reached (${limit}) for your ${org.plan.name} plan.`,
      limit,
      currentUsage,
    };
  }

  return {
    allowed: true,
    status: 200,
    code: "OK",
    limit,
    currentUsage,
  };
};
