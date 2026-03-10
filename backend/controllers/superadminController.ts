import type { Request, Response } from "express";
import { organizations, projects, folders, users } from "../models/index.ts";

export const getOrgOverview = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        // Ensure this endpoint is exclusively for SuperAdmins
        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const orgId = authUser.organization_id;

        // Fetch All Users mapped to this Organization
        const orgUsers = await users.findAll({
            where: { organization_id: orgId },
            attributes: ['id', 'name', 'email', 'role', 'is_primary']
        });

        // Fetch Organization metadata
        const orgDetails = await organizations.findByPk(orgId);

        // Fetch all projects for this Orgainzation, including their nested folders
        const allProjects = await projects.findAll({
            where: { organization_id: orgId },
            include: [{
                model: folders,
                as: "folders"
            }]
        });

        res.status(200).json({
            organization: orgDetails,
            users: orgUsers,
            projects: allProjects
        });

    } catch (error) {
        console.error("SuperAdmin Overview Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSuperAdmins = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        // Fetch all SuperAdmins
        const allSuperAdmins = await users.findAll({
            where: { role: 'superadmin' },
            attributes: ['id', 'name', 'email', 'role', 'is_primary', 'createdAt']
        });

        res.status(200).json({ teams: allSuperAdmins });
    } catch (error) {
        console.error("Get SuperAdmins Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getOrganizations = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const allOrgs = await organizations.findAll({
            attributes: ['id', 'name', 'logo'],
            order: [['name', 'ASC']]
        });

        res.status(200).json({ organizations: allOrgs });
    } catch (error) {
        console.error("Get Organizations Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
