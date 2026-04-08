import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { organizations } from "../models/index.ts";
import { getSubscriptionAccessState } from "../utils/subscriptionAccess.ts";

// Exporting a custom Request type if we want robust typing
export interface AuthRequest extends Request {
    user?: any;
}

const isSubscriptionAllowedPath = (path: string) => {
    return path.startsWith("/api/subscription") || path.startsWith("/api/auth/me");
};

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        req.user = decoded; // { user_id, role, organization_id, project_id? }
        
        const sessionUser: any = decoded;
        if (sessionUser?.role !== "superadmin" && sessionUser?.organization_id) {
            const org = await organizations.findByPk(sessionUser.organization_id);
            if (org) {
                const access = getSubscriptionAccessState((org as any).plan_end_date);
                req.user = {
                    ...(req.user as any),
                    subscription_access: {
                        is_locked: access.isLocked,
                        is_in_grace_period: access.isInGracePeriod,
                        plan_end_date: access.planEndDate,
                        grace_end_date: access.graceEndDate,
                        grace_days_remaining: access.graceDaysRemaining,
                    },
                };

                const requestPath = req.originalUrl || req.path || "";
                if (access.isLocked && !isSubscriptionAllowedPath(requestPath)) {
                    return res.status(403).json({
                        error: "Subscription Locked",
                        message: "Your plan expired and grace period has ended. Please renew to continue.",
                        code: "SUBSCRIPTION_LOCKED",
                        plan_end_date: access.planEndDate,
                        grace_end_date: access.graceEndDate,
                    });
                }
            }
        }
        next();
    } catch (error) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

export const isSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === "superadmin") {
        next();
    } else {
        res.status(403).json({ error: "Requires SuperAdmin role" });
    }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ error: "Requires Admin role" });
    }
};

export const isContributorOrClient = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && (req.user.role === "contributor" || req.user.role === "client")) {
        next();
    } else {
        res.status(403).json({ error: "Requires Project specific role" });
    }
};

export const isNotClient = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role !== "client") {
        next();
    } else {
        res.status(403).json({ error: "Clients are not authorized to perform this action" });
    }
};
