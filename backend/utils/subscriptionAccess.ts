import { organizations, plans, users, projects, project_members, files, manuals, Sequelize } from "../models/index.ts";
import { Op } from "sequelize";

export const SUBSCRIPTION_GRACE_DAYS = 4;

export interface LimitCheckResult {
  allowed: boolean;
  status: number;
  code: string;
  message?: string;
  limit?: number;
  currentUsage?: number;
}

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
  role: "contributor" | "client" | "consultant" | "vendor",
  projectId?: number,
): Promise<LimitCheckResult> => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org || !org.plan) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization or Plan not found",
    };
  }

  // Only "contributor" role consumes seats. Client, consultant, and vendor roles do not consume seats and are unlimited.
  if (role !== "contributor") {
    return {
      allowed: true,
      status: 200,
      code: "OK",
      limit: 999999,
      currentUsage: 0,
    };
  }

  const limit = org.seats_purchased || org.plan?.contributor_limit || 1;

  const orgProjectIds = (
    await projects.findAll({
      where: { organization_id: org.id },
      attributes: ["id"],
    })
  ).map((p: any) => p.id);

  let currentUsage = 0;

  if (orgProjectIds.length > 0) {
    currentUsage = await project_members.count({
      where: {
        project_id: { [Op.in]: orgProjectIds },
        role: "contributor",
      },
    });
  }

  if (currentUsage >= limit) {
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `Organization contributor seat limit reached (${limit} seat(s) allowed across organization). Upgrade your seats to add more contributors.`,
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

export const checkProjectLimit = async (organizationId: number): Promise<LimitCheckResult> => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization not found",
    };
  }

  const isPaidPlan = Boolean(org.plan_name && !["freemium", "free"].includes(org.plan_name.toLowerCase()));
  if (isPaidPlan) {
    return { allowed: true, status: 200, code: "OK", limit: 999999, currentUsage: 0 };
  }

  const limit = org.plan?.project_limit || 10;
  const currentUsage = await projects.count({
    where: { organization_id: organizationId },
  });

  if (currentUsage >= limit) {
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `Project limit reached (${limit}) for Freemium plan. Please upgrade to create more projects.`,
      limit,
      currentUsage,
    };
  }

  return { allowed: true, status: 200, code: "OK", limit, currentUsage };
};

export const checkStorageLimit = async (
  organizationId: number,
  incomingSizeMb: number,
  projectId?: number,
  userRole?: string,
): Promise<LimitCheckResult> => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization not found",
    };
  }

  // Storage limit check: prioritize organization's specific storage_limit_mb if set, else plan limit / defaults
  const isPaidPlan = Boolean(org.plan_name && !["freemium", "free"].includes(org.plan_name.toLowerCase()));
  let limitMb = org.storage_limit_mb || org.plan?.storage_limit_mb || (isPaidPlan ? 5120 : 2048);
  if (!isPaidPlan && !org.storage_limit_mb) {
    limitMb = 2048;
  }
  let currentUsedMb = 0;

  if (projectId) {
    const fileSumMb = (await files.sum("file_size_mb", { where: { project_id: projectId }, paranoid: false })) || 0;
    const manualSumMb = (await manuals.sum("file_size_mb", { where: { project_id: projectId }, paranoid: false })) || 0;
    currentUsedMb = Number(fileSumMb) + Number(manualSumMb);
  } else {
    // If no specific project ID provided, check max project storage across org projects (including trashed items)
    const orgProjectIds = (
      await projects.findAll({
        where: { organization_id: organizationId },
        attributes: ["id"],
        paranoid: false,
      })
    ).map((p: any) => p.id);

    if (orgProjectIds.length > 0) {
      const counts: any[] = await files.findAll({
        where: { project_id: { [Op.in]: orgProjectIds } },
        attributes: ["project_id", [Sequelize.fn("SUM", Sequelize.col("file_size_mb")), "sum_size"]],
        group: ["project_id"],
        raw: true,
        paranoid: false,
      });

      const manualCounts: any[] = await manuals.findAll({
        where: { project_id: { [Op.in]: orgProjectIds } },
        attributes: ["project_id", [Sequelize.fn("SUM", Sequelize.col("file_size_mb")), "sum_size"]],
        group: ["project_id"],
        raw: true,
        paranoid: false,
      });

      const projectTotals = new Map<number, number>();
      counts.forEach((item) => {
        projectTotals.set(Number(item.project_id), Number(item.sum_size || 0));
      });
      manualCounts.forEach((item) => {
        const existing = projectTotals.get(Number(item.project_id)) || 0;
        projectTotals.set(Number(item.project_id), existing + Number(item.sum_size || 0));
      });

      currentUsedMb = Array.from(projectTotals.values()).reduce((max, size) => Math.max(max, size), 0);
    } else {
      currentUsedMb = org.storage_used_mb || 0;
    }
  }

  if (currentUsedMb + incomingSizeMb > limitMb) {
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    const actionText = isAdmin
      ? "Contact support@apexis.in to increase your storage."
      : "Please contact your project Admin to increase the storage.";

    const message = `Storage limit reached for this project (${limitMb} MB limit). ${actionText}`;

    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message,
      limit: limitMb,
      currentUsage: currentUsedMb,
    };
  }

  return { allowed: true, status: 200, code: "OK", limit: limitMb, currentUsage: currentUsedMb };
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
