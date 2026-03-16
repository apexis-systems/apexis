import type { Request, Response } from "express";
import crypto from "crypto";
import { projects, users, folders, files, organizations, project_members, Sequelize } from "../models/index.ts";
import { Op, fn, col, literal } from "sequelize";

// Helper to generate 6-character random alphanumeric code
const generateCode = () => {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
};

export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, description, start_date, end_date } = req.body;

        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can create projects" });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: "Start date and end date are required" });
        }

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

        const { organization_id } = req.query;

        // Build WHERE condition based on role
        let whereCondition: any = {};

        if (authUser.role === 'superadmin') {
            if (organization_id) {
                whereCondition.organization_id = organization_id;
            }
            // else: no filter, fetch all
        } else if (authUser.role === 'admin') {
            whereCondition.organization_id = authUser.organization_id;
        } else if (authUser.role === 'contributor' || authUser.role === 'client') {
            if (!authUser.project_id) {
                return res.status(400).json({ error: "No project linked to session" });
            }
            whereCondition.id = authUser.project_id;
        }

        const result = await projects.findAll({
            where: whereCondition,
            attributes: {
                include: [
                    [
                        literal(`CAST(COUNT(CASE WHEN "files"."file_type" LIKE 'image/%' THEN 1 END) AS INTEGER)`),
                        'totalPhotos'
                    ],
                    [
                        literal(`CAST(COUNT(CASE WHEN "files"."file_type" NOT LIKE 'image/%' THEN 1 END) AS INTEGER)`),
                        'totalDocs'
                    ],
                ],
            },
            include: [
                {
                    model: organizations,
                    as: 'organization',
                    attributes: ['id', 'name'],
                },
                {
                    model: files,
                    attributes: [],
                    required: false,
                },
            ],
            group: [
                literal('"projects"."id"'),
                literal('"organization"."id"'),
            ],
            order: [['createdAt', 'DESC']],
            subQuery: false,
        });

        // Strip sensitive codes for non-admins
        const safeRows = result.map((p: any) => {
            const json = p.toJSON();
            if (authUser.role !== 'admin') {
                delete json.contributor_code;
                delete json.client_code;
            }
            return json;
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

export const updateProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, start_date, end_date } = req.body;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can update projects" });
        }

        const project = await projects.findOne({ where: { id, organization_id: authUser.organization_id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        await project.update({
            name: name || project.name,
            description: description || project.description,
            start_date: start_date || project.start_date,
            end_date: end_date || project.end_date,
        });

        res.status(200).json({ message: "Project updated successfully", project });
    } catch (error) {
        console.error("Update Project Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
