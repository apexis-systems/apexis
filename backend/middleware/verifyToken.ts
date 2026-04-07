import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Exporting a custom Request type if we want robust typing
export interface AuthRequest extends Request {
    user?: any;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        req.user = decoded; // { user_id, role, organization_id, project_id? }
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
