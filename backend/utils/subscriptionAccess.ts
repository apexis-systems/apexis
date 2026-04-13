import { organizations, plans, users, projects } from "../models/index.ts";

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

export const checkProjectLimit = async (organizationId: number) => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org || !org.plan) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization or Plan not found",
    };
  }

  const limit = org.plan.project_limit;
  const currentUsage = await projects.count({
    where: { organization_id: organizationId },
  });

  if (currentUsage >= limit) {
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `Project limit reached (${limit}) for your ${org.plan.name} plan.`,
      limit,
      currentUsage,
    };
  }

  return { allowed: true, status: 200, code: "OK", limit, currentUsage };
};

export const checkStorageLimit = async (
  organizationId: number,
  incomingSizeMb: number,
) => {
  const org = await organizations.findByPk(organizationId, {
    include: [{ model: plans }],
  });
  if (!org || !org.plan) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization or Plan not found",
    };
  }

  const limitMb = org.storage_limit_mb || org.plan.storage_limit_mb;
  const currentUsedMb = org.storage_used_mb || 0;

  if (currentUsedMb + incomingSizeMb > limitMb) {
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `Storage limit exceeded. Remaining storage is ${Math.max(0, limitMb - currentUsedMb).toFixed(2)} MB.`,
      limit: limitMb,
      currentUsage: currentUsedMb,
    };
  }

  return { allowed: true, status: 200, code: "OK" };
};

export const checkSubscriptionStatus = async (organizationId: number) => {
  const org = await organizations.findByPk(organizationId);
  if (!org) {
    return { allowed: false, status: 404, message: "Organization not found" };
  }

  const access = getSubscriptionAccessState(org.plan_end_date);
  if (access.isLocked) {
    return {
      allowed: false,
      status: 403,
      code: "SUBSCRIPTION_LOCKED",
      message:
        "Your subscription is locked. Please renew to continue using the service.",
    };
  }

  return { allowed: true, status: 200 };
};
