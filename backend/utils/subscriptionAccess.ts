import { organizations, plans, users, projects, project_members, files, Sequelize } from "../models/index.ts";
import { Op } from "sequelize";

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
  role: "contributor" | "client" | "consultant" | "vendor",
  projectId?: number,
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

  const isContributorType = role === "contributor" || role === "consultant" || role === "vendor";
  const mappedRole = isContributorType ? "contributor" : "client";
  const roleQuery = isContributorType ? ["contributor", "consultant", "vendor"] : ["client"];

  const limit =
    mappedRole === "contributor"
      ? (org.seats_purchased || org.plan?.contributor_limit || 1)
      : (org.plan?.client_limit || 999);

  let currentUsage = 0;

  if (projectId) {
    // Count seats specifically in this target project
    const memberCount = await project_members.count({
      where: {
        project_id: projectId,
        role: { [Op.in]: roleQuery },
      },
    });
    currentUsage = memberCount;
  } else {
    // Find max seats used in any single project of this organization
    const orgProjectIds = (
      await projects.findAll({
        where: { organization_id: org.id },
        attributes: ["id"],
      })
    ).map((p: any) => p.id);

    if (orgProjectIds.length > 0) {
      const counts: any[] = await project_members.findAll({
        where: {
          project_id: { [Op.in]: orgProjectIds },
          role: { [Op.in]: roleQuery },
        },
        attributes: ["project_id", [Sequelize.fn("COUNT", Sequelize.col("user_id")), "count"]],
        group: ["project_id"],
        raw: true,
      });

      currentUsage = counts.reduce((max, item) => Math.max(max, Number(item.count || 0)), 0);
    }
  }

  if (currentUsage >= limit) {
    const roleLabel = mappedRole === "contributor" ? "Project team seats" : "Client";
    return {
      allowed: false,
      status: 403,
      code: "LIMIT_REACHED",
      message: `${roleLabel} limit reached (${limit} seat(s) allowed per project). Upgrade your seat count to add more members.`,
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
  projectId?: number,
  userRole?: string,
) => {
  const org = await getOrganizationWithPlan(organizationId);
  if (!org) {
    return {
      allowed: false,
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "Organization not found",
    };
  }

  // Storage limit check: prioritize organization's specific limit, fallback to plan limit, then default 5000 MB
  const limitMb = org.storage_limit_mb || org.plan?.storage_limit_mb || 5000;
  let currentUsedMb = 0;

  if (projectId) {
    const fileSumMb = (await files.sum("file_size_mb", { where: { project_id: projectId } })) || 0;
    currentUsedMb = Number(fileSumMb);
  } else {
    // If no specific project ID provided, check max project storage across org projects
    const orgProjectIds = (
      await projects.findAll({
        where: { organization_id: organizationId },
        attributes: ["id"],
      })
    ).map((p: any) => p.id);

    if (orgProjectIds.length > 0) {
      const counts: any[] = await files.findAll({
        where: { project_id: { [Op.in]: orgProjectIds } },
        attributes: ["project_id", [Sequelize.fn("SUM", Sequelize.col("file_size_mb")), "sum_size"]],
        group: ["project_id"],
        raw: true,
      });

      currentUsedMb = counts.reduce((max, item) => Math.max(max, Number(item.sum_size || 0)), 0);
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
