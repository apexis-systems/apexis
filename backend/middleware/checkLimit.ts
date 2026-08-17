import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./verifyToken.ts";
import db, {
  organizations,
  plans,
  projects,
  users,
  snags,
  rfis,
} from "../models/index.ts";
import { Op } from "sequelize";
import { getSubscriptionAccessState, checkMemberLimit, checkStorageLimit } from "../utils/subscriptionAccess.ts";

export type LimitType =
  | "project"
  | "storage"
  | "member"
  | "snag"
  | "rfi"
  | "export_reports"
  | "export_handover";

export const checkLimit = (type: LimitType) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user;

      // Guard: if verifyToken didn't populate req.user, reject early
      if (!authUser) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      let activeOrgId = authUser?.organization_id;

      if (!activeOrgId) {
        // 1. Try to resolve from the user's active project context in the token (common for contributors)
        if (authUser?.project_id) {
          const project = await projects.findByPk(authUser.project_id, {
            attributes: ["organization_id"],
          });
          activeOrgId = project?.organization_id;
        }

        // 2. If still missing (e.g. admin or token lacks project_id), resolve from the request
        if (!activeOrgId) {
          let projectId =
            req.body?.project_id ||
            req.query?.project_id ||
            req.body?.projectId ||
            req.params.project_id;

          // Special case for handover exports where project ID is in the URL path
          if (!projectId && type === "export_handover") {
            projectId = req.params?.id;
          }

          if (projectId) {
            const project = await projects.findByPk(projectId, {
              attributes: ["organization_id"],
            });
            activeOrgId = project?.organization_id;
          }
        }

        // 3. Last fallback: if it's an admin, check their primary organization
        if (!activeOrgId && (authUser?.role === "admin" || authUser?.role === "superadmin")) {
          const dbUser = await users.findByPk(authUser.user_id, {
            attributes: ["organization_id"],
          });
          activeOrgId = dbUser?.organization_id;
        }
      }

      if (!activeOrgId) {
        console.warn(
          `[checkLimit] Missing organization context for user ${authUser?.user_id} (role: ${authUser?.role}). Type: ${type}, Query:`,
          req.query,
        );
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing organization context" });
      }

      // 1. Fetch Organization and its Plan
      const org = await organizations.findByPk(activeOrgId, {
        include: [{ model: plans }],
      });

      if (!org || !org.plan) {
        return res
          .status(404)
          .json({ error: "Organization or Plan not found" });
      }

      const plan = org.plan;

      // 2. Subscription access check with grace period
      const access = getSubscriptionAccessState(org.plan_end_date);
      if (access.isLocked) {
        return res.status(403).json({
          error: "Subscription Locked",
          message:
            "Your plan expired and grace period has ended. Please renew to continue.",
          code: "SUBSCRIPTION_LOCKED",
          plan_end_date: access.planEndDate,
          grace_end_date: access.graceEndDate,
        });
      }

      // 3. Resource Specific Checks
      let currentUsage = 0;
      let limit = 0;
      let errorMessage = "Plan limit reached";

      switch (type) {
        case "project": {
          const isPaidPlan = Boolean(org.plan_name && !["freemium", "free"].includes(org.plan_name.toLowerCase()));
          if (isPaidPlan) {
            return next();
          }
          currentUsage = await projects.count({
            where: { organization_id: org.id },
          });
          limit = plan?.project_limit || 10;
          errorMessage = `You have reached the limit of ${limit} projects for your Freemium plan. Please upgrade to create more projects.`;
          break;
        }

        case "storage": {
          const uploadReq = req as AuthRequest & {
            file?: { size?: number };
            files?: Array<{ size?: number }> | { [fieldname: string]: Array<{ size?: number }> };
          };
          let incomingBytes = 0;
          if (uploadReq.file) {
            incomingBytes = uploadReq.file.size || 0;
          } else if (uploadReq.files) {
            if (Array.isArray(uploadReq.files)) {
              const filesArr = uploadReq.files as Array<{ size?: number }>;
              incomingBytes = filesArr.reduce((acc, f) => acc + (f.size || 0), 0);
            } else if (typeof uploadReq.files === "object") {
              Object.values(uploadReq.files).forEach((fileArray) => {
                if (Array.isArray(fileArray)) {
                  const filesArr = fileArray as Array<{ size?: number }>;
                  incomingBytes += filesArr.reduce((acc, f) => acc + (f.size || 0), 0);
                }
              });
            }
          }
          const incomingSizeMb = Math.ceil(incomingBytes / (1024 * 1024));

          const targetProjectId = req.params?.id || req.params?.projectId || req.body?.project_id || req.body?.projectId || (req.query?.project_id as string) || authUser?.project_id;
          const userRole = (req as any).user?.role;

          const limitCheck = await checkStorageLimit(
            org.id,
            incomingSizeMb,
            targetProjectId ? Number(targetProjectId) : undefined,
            userRole
          );

          if (!limitCheck.allowed) {
            return res.status(403).json({
              error: "Limit Reached",
              message: limitCheck.message,
              code: "LIMIT_REACHED",
              limit: limitCheck.limit,
              currentUsage: limitCheck.currentUsage,
            });
          }
          return next();
        }

        case "member": {
          const requestedRole = req.body?.role || "contributor";
          const targetProjectId = req.params?.id || req.params?.projectId || req.body?.project_id || req.body?.projectId;
          const limitCheck = await checkMemberLimit(org.id, requestedRole, targetProjectId ? Number(targetProjectId) : undefined);
          if (!limitCheck.allowed) {
            return res.status(403).json({
              error: "Limit Reached",
              message: limitCheck.message || `Organization seats are full (${org.seats_purchased || 1} seats purchased). Please upgrade your seats to add more team members.`,
              code: "LIMIT_REACHED",
              limit: limitCheck.limit,
              currentUsage: limitCheck.currentUsage,
            });
          }
          return next();
        }

        case "snag":
          // Count snags across all projects in the org
          const projectIds = (
            await projects.findAll({
              where: { organization_id: org.id },
              attributes: ["id"],
            })
          ).map((p: any) => p.id);
          currentUsage = await snags.count({
            where: { project_id: { [Op.in]: projectIds } },
          });
          limit = plan.max_snags;
          errorMessage = `Snag limit reached for your plan (${limit}).`;
          break;

        case "rfi":
          const pIds = (
            await projects.findAll({
              where: { organization_id: org.id },
              attributes: ["id"],
            })
          ).map((p: any) => p.id);
          currentUsage = await rfis.count({
            where: { project_id: { [Op.in]: pIds } },
          });
          limit = plan.max_rfis;
          errorMessage = `RFI limit reached for your plan (${limit}).`;
          break;

        case "export_reports":
          if (!plan.can_export_reports) {
            return res.status(403).json({
              error: "Feature Restricted",
              message: "Report exporting is not included in your current plan.",
              code: "FEATURE_RESTRICTED",
            });
          }
          return next();

        case "export_handover":
          if (!plan.can_export_handover) {
            return res.status(403).json({
              error: "Feature Restricted",
              message:
                "Handover exporting is not included in your current plan.",
              code: "FEATURE_RESTRICTED",
            });
          }
          return next();

        default:
          return next();
      }

      if (currentUsage >= limit) {
        return res.status(403).json({
          error: "Limit Reached",
          message: errorMessage,
          code: "LIMIT_REACHED",
        });
      }

      next();
    } catch (error) {
      console.error("CheckLimit Middleware Error:", error);
      res
        .status(500)
        .json({ error: "Internal server error during limit check" });
    }
  };
};
