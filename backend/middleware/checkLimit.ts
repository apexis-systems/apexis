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
import { getSubscriptionAccessState } from "../utils/subscriptionAccess.ts";

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
      if (!authUser || !authUser.organization_id) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing organization context" });
      }

      // 1. Fetch Organization and its Plan
      const org = await organizations.findByPk(authUser.organization_id, {
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
        case "project":
          currentUsage = await projects.count({
            where: { organization_id: org.id },
          });
          limit = plan.project_limit;
          errorMessage = `You have reached the limit of ${limit} projects for your ${plan.name} plan.`;
          break;

        case "storage":
          // Storage is already tracked in org.storage_used_mb
          // We check if NEW upload will exceed limit.
          const uploadReq = req as AuthRequest & {
            file?: { size?: number };
            files?: Array<{ size?: number }>;
          };
          let incomingSizeMb = 0;
          if (uploadReq.file) {
            incomingSizeMb = Math.ceil(
              (uploadReq.file.size || 0) / (1024 * 1024),
            );
          } else if (uploadReq.files && Array.isArray(uploadReq.files)) {
            const totalBytes = uploadReq.files.reduce(
              (acc, f) => acc + (f.size || 0),
              0,
            );
            incomingSizeMb = Math.ceil(totalBytes / (1024 * 1024));
          }

          currentUsage = org.storage_used_mb;
          limit = plan.storage_limit_mb;
          errorMessage = `Storage limit reached (${limit}MB). Please upgrade for more space.`;
          if (currentUsage + incomingSizeMb > limit) {
            return res
              .status(403)
              .json({
                error: "Limit Reached",
                message: errorMessage,
                code: "LIMIT_REACHED",
              });
          }
          return next(); // Storage check is sum-based

        case "member":
          const requestedRole = req.body.role;
          if (requestedRole === "contributor") {
            currentUsage = await users.count({
              where: { organization_id: org.id, role: "contributor" },
            });
            limit = plan.contributor_limit;
            errorMessage = `Contributor limit reached (${limit}) for your ${plan.name} plan.`;
          } else if (requestedRole === "client") {
            currentUsage = await users.count({
              where: { organization_id: org.id, role: "client" },
            });
            limit = plan.client_limit;
            errorMessage = `Client limit reached (${limit}) for your ${plan.name} plan.`;
          } else {
            return next(); // admin or others don't have count limits usually
          }
          break;

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
