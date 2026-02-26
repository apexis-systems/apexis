import type { Request, Response } from "express";
import crypto from "crypto";
import { projects, users } from "../models/index.ts";

// Helper to generate 6-character random alphanumeric code
const generateCode = () => {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
};

export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        // We expect the verifyToken middleware to attach `user` to `req`
        // with role and organization_id
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can create projects" });
        }

        // Ensure unique codes
        let contributor_code = generateCode();
        let client_code = generateCode();

        const newProject = await projects.create({
            organization_id: authUser.organization_id,
            name,
            description,
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

        res.status(200).json({ projects: projectsList });
    } catch (error) {
        console.error("Get Projects Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
