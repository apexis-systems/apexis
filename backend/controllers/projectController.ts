import type { Request, Response } from "express";
import crypto from "crypto";
import { startExportProcess, activeExports } from "../services/exportService.ts";
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";
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

        if (name && name.length > 25) {
            return res.status(400).json({ error: "Project name cannot exceed 25 characters" });
        }

        if (description && description.length > 50) {
            return res.status(400).json({ error: "Project description cannot exceed 50 characters" });
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

        // Create default folders (Photo & Doc types)
        const folderNames = [
            "3D files", "3D images", "Architectural", "Automation",
            "Brick marking", "Carpentry", "Electrical", "Fabrication",
            "Flooring", "HVAC", "Interiors", "Landscape",
            "Permit", "Plumbing", "Structural"
        ];

        const folderCreationTasks: any[] = [];
        folderNames.forEach((name) => {
            // Create for Photos
            folderCreationTasks.push(folders.create({
                project_id: newProject.id,
                name,
                created_by: authUser.user_id,
                client_visible: true,
                folder_type: "photo",
            }));
            // Create for Docs
            folderCreationTasks.push(folders.create({
                project_id: newProject.id,
                name,
                created_by: authUser.user_id,
                client_visible: true,
                folder_type: "document",
            }));
        });

        await Promise.all(folderCreationTasks);

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
            if (authUser.project_id) {
                // User logged in with a specific project code, restrict to ONLY that project
                whereCondition.id = authUser.project_id;
            } else {
                const userMemberships = await project_members.findAll({
                    where: { user_id: authUser.user_id },
                    attributes: ['project_id']
                });
                const projectIds = userMemberships.map((pm: any) => pm.project_id);
                whereCondition.id = { [Op.in]: projectIds };
            }
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
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "folders" WHERE "folders"."project_id" = "projects"."id")`),
                        'totalFolders'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm JOIN "users" u ON pm.user_id = u.id WHERE pm."project_id" = "projects"."id" AND pm."role" = 'contributor' AND u."role" != 'admin')`),
                        'totalContributors'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm JOIN "users" u ON pm.user_id = u.id WHERE pm."project_id" = "projects"."id" AND pm."role" = 'client' AND u."role" != 'admin')`),
                        'totalClients'
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

        const project = await projects.findOne({ 
            where: { id },
            attributes: {
                include: [
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm JOIN "users" u ON pm.user_id = u.id WHERE pm."project_id" = "projects"."id" AND pm."role" = 'contributor' AND u."role" != 'admin')`),
                        'totalContributors'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm JOIN "users" u ON pm.user_id = u.id WHERE pm."project_id" = "projects"."id" AND pm."role" = 'client' AND u."role" != 'admin')`),
                        'totalClients'
                    ]
                ]
            }
        });

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

        if (name && name.length > 25) {
            return res.status(400).json({ error: "Project name cannot exceed 25 characters" });
        }

        if (description && description.length > 50) {
            return res.status(400).json({ error: "Project description cannot exceed 50 characters" });
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

export const exportHandoverPackage = async (req: Request, res: Response) => {
    try {
        const { id: projectId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can export projects" });
        }

        const project = await projects.findOne({ where: { id: projectId, organization_id: authUser.organization_id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        // Trigger the background service
        startExportProcess(project.id, authUser.user_id, authUser.organization_id);

        res.status(202).json({ message: "Export started. You will be notified via websocket." });
    } catch (error) {
        console.error("Export Project Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getLatestExport = async (req: Request, res: Response) => {
    try {
        const { id: projectId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can export projects" });
        }

        const project = await projects.findOne({ where: { id: projectId, organization_id: authUser.organization_id } });

        const activeExport = activeExports.get(Number(projectId));

        let downloadUrl = null;
        if (project.last_export_url) {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: project.last_export_url });
            downloadUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 7 * 24 * 3600 }); // 7 days
        }

        if (!downloadUrl && !activeExport) {
            return res.status(404).json({ error: "No export found for this project" });
        }

        res.status(200).json({ 
            downloadUrl, 
            last_export_date: project.last_export_date,
            activeExport 
        });
    } catch (error) {
        console.error("Get Latest Export Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getProjectShareLinks = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.query;
        const authUser = (req as any).user;
        const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4000";

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can get share links" });
        }

        const project = await projects.findOne({ where: { id, organization_id: authUser.organization_id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        const response: any = {};
        
        if (!role || role === 'contributor') {
            response.contributorLink = `${FRONTEND_URL}/auth/login-redirect?role=contributor&code=${project.contributor_code}`;
            response.contributorCode = project.contributor_code;
        }
        
        if (!role || role === 'client') {
            response.clientLink = `${FRONTEND_URL}/auth/login-redirect?role=client&code=${project.client_code}`;
            response.clientCode = project.client_code;
        }

        res.status(200).json(response);
    } catch (error) {
        console.error("Get Share Links Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getProjectMembers = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can view project members" });
        }

        const project = await projects.findOne({ where: { id, organization_id: authUser.organization_id } });
        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        const members = await project_members.findAll({
            where: { project_id: id },
            include: [{
                model: users,
                where: { role: { [Op.ne]: 'admin' } },
                attributes: ['id', 'name', 'email', 'phone_number', 'role', 'profile_pic', 'createdAt']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ members });
    } catch (error) {
        console.error("Get Project Members Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
