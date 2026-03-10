import type { Request, Response } from "express";
import crypto from "crypto";
import { projects, users } from "../models/index.ts";

// Helper to generate 6-character random alphanumeric code
const generateCode = () => {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
};

export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, description, start_date, end_date } = req.body;

        // We expect the verifyToken middleware to attach `user` to `req`
        // with role and organization_id
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can create projects" });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: "Start date and end date are required" });
        }

        // Ensure unique codes
        let contributor_code = generateCode();
        let client_code = generateCode();

        const newProject = await projects.create({
            organization_id: authUser.organization_id,
            name,
            description,
            start_date,
            end_date,
            contributor_code,
            client_code,
            created_by: authUser.user_id,
        });

        res.status(201).json({ message: "Project created successfully", project: newProject });
    } catch (error) {
        console.error("Create Project Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getProjects = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ error: "Unauthorized" });

        const { sequelize } = await import('../models/index.ts');

        // Build WHERE clause based on role
        let whereClause = '';
        const replacements: any = {};
        const { organization_id } = req.query;

        if (authUser.role === 'superadmin') {
            if (organization_id) {
                whereClause = 'WHERE p.organization_id = :org_id';
                replacements.org_id = organization_id;
            } else {
                whereClause = '';
            }
        } else if (authUser.role === 'admin') {
            whereClause = 'WHERE p.organization_id = :org_id';
            replacements.org_id = authUser.organization_id;
        } else if (authUser.role === 'contributor' || authUser.role === 'client') {
            if (!authUser.project_id) return res.status(400).json({ error: "No project linked to session" });
            whereClause = 'WHERE p.id = :project_id';
            replacements.project_id = authUser.project_id;
        }

        const [rows] = await sequelize.query(`
            SELECT
                p.*,
                COUNT(CASE WHEN f.file_type LIKE 'image/%' THEN 1 END)::int        AS "totalPhotos",
                COUNT(CASE WHEN f.file_type NOT LIKE 'image/%' THEN 1 END)::int    AS "totalDocs"
            FROM public.projects p
            LEFT JOIN public.folders fo ON fo.project_id = p.id
            LEFT JOIN public.files    f  ON f.folder_id  = fo.id
            ${whereClause}
            GROUP BY p.id
            ORDER BY p."createdAt" DESC
        `, { replacements });

        // Strip sensitive codes for non-admins
        const safeRows = (rows as any[]).map((p: any) => {
            if (authUser.role !== 'admin') {
                delete p.contributor_code;
                delete p.client_code;
            }
            return p;
        });

        res.status(200).json({ projects: safeRows });
    } catch (error) {
        console.error("Get Projects Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getProjectById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const project = await projects.findOne({ where: { id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Restrict access for non-superadmins
        if (authUser.role === "admin" && project.organization_id !== authUser.organization_id) {
            return res.status(403).json({ error: "Forbidden: Not part of organization" });
        }
        if ((authUser.role === "contributor" || authUser.role === "client") && authUser.project_id !== project.id) {
            return res.status(403).json({ error: "Forbidden: Not assigned to this project" });
        }

        let projectOutput = project.toJSON ? project.toJSON() : project;

        // Strip sensitive codes for non-admins
        if (authUser.role !== "admin") {
            delete projectOutput.contributor_code;
            delete projectOutput.client_code;
        }

        res.status(200).json({ project: projectOutput });
    } catch (error) {
        console.error("Get Project By ID Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
