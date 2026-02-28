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
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        let projectsList;
        if (authUser.role === "superadmin") {
            // SuperAdmin sees all projects
            projectsList = await projects.findAll();
        } else if (authUser.role === "admin") {
            // Admin sees organization projects
            projectsList = await projects.findAll({
                where: { organization_id: authUser.organization_id }
            });
        } else if (authUser.role === "contributor" || authUser.role === "client") {
            // Contributor/Client see only linked projects
            // The JWT for these users should have `project_id` attached
            if (!authUser.project_id) {
                return res.status(400).json({ error: "No project linked to session" });
            }
            projectsList = await projects.findAll({
                where: { id: authUser.project_id }
            });
        }

        if (authUser.role !== "admin") {
            // Strip out sensitive codes for non-admins
            projectsList = projectsList.map((p: any) => {
                const projectOutput = p.toJSON ? p.toJSON() : p;
                delete projectOutput.contributor_code;
                delete projectOutput.client_code;
                return projectOutput;
            });
        }

        res.status(200).json({ projects: projectsList });
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
