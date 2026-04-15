import type { Request, Response } from "express";
import crypto from "crypto";
import { startExportProcess, activeExports } from "../services/exportService.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { projects, users, folders, files, organizations, project_members, room_members, rooms, notifications, sequelize, Sequelize } from "../models/index.ts";
import { Op, fn, col, literal } from "sequelize";

import { checkProjectLimit } from "../utils/subscriptionAccess.ts";
import { getIO } from "../socket.ts";

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

        // Check project limit
        const limitCheck = await checkProjectLimit(authUser.organization_id);
        if (!limitCheck.allowed) {
            return res.status(limitCheck.status).json({
                error: limitCheck.message,
                code: limitCheck.code,
                limit: limitCheck.limit,
                currentUsage: limitCheck.currentUsage
            });
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

        const { organization_id: queryOrgId } = req.query;
        const activeOrgId = authUser.organization_id;
        const activeRole = authUser.role;

        // Build WHERE condition based on role and organization context
        let whereCondition: any = {};

        if (activeRole === 'superadmin') {
            if (queryOrgId) {
                whereCondition.organization_id = queryOrgId;
            }
        } else if (activeRole === 'admin') {
            // If we have a specific organization in the query or token, use it.
            // Otherwise (Global Admin), show projects from their primary org 
            // AND any projects where they might be an admin in project_members.
            if (queryOrgId) {
                whereCondition.organization_id = queryOrgId;
            } else if (activeOrgId) {
                whereCondition.organization_id = activeOrgId;
            } else {
                // Global Admin view: Fetch projects from primary org
                const dbUser = await users.findByPk(authUser.user_id);
                const adminProjectIds: number[] = []; // Admin role doesn't exist in project_members table enum
                
                whereCondition[Op.or] = [
                    dbUser?.organization_id ? { organization_id: dbUser.organization_id } : null,
                    adminProjectIds.length > 0 ? { id: { [Op.in]: adminProjectIds } } : null
                ].filter(Boolean);
            }
        } else if (activeRole === 'contributor' || activeRole === 'client') {
            // Fetch projects where the user has an explicit membership record with the ACTIVE role
            const userMemberships = await project_members.findAll({
                where: { user_id: authUser.user_id, role: activeRole },
                attributes: ['project_id']
            });
            const projectIds = userMemberships.map((pm: any) => pm.project_id);
            
            if (queryOrgId) {
                whereCondition.organization_id = queryOrgId;
                whereCondition.id = { [Op.in]: projectIds };
            } else {
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
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" = 'contributor')`),
                        'totalContributors'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" = 'client')`),
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
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" = 'contributor')`),
                        'totalContributors'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" = 'client')`),
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
            // Check if the user is a member of this project (perhaps with a different role)
            const membership = await project_members.findOne({
                where: { project_id: project.id, user_id: authUser.user_id }
            });
            if (!membership) {
                return res.status(403).json({ error: "Forbidden: Not part of organization" });
            }
        }

        if (authUser.role === "contributor" || authUser.role === "client") {
            // Check if user is a member of this project in the database with the active role
            const membership = await project_members.findOne({
                where: { project_id: project.id, user_id: authUser.user_id, role: authUser.role }
            });
            if (!membership) {
                return res.status(403).json({ error: "Forbidden: Not assigned to this project" });
            }
        }

        let projectOutput = project.toJSON ? project.toJSON() : project;

        // Strip sensitive codes by role
        if (authUser.role === "client") {
            delete projectOutput.contributor_code;
        } else if (authUser.role === "contributor") {
            delete projectOutput.client_code;
        } else if (authUser.role !== "admin" && authUser.role !== "superadmin") {
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

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const requestedRole = typeof role === "string" ? role : undefined;
        const project =
            authUser.role === "client"
                ? await projects.findByPk(id)
                : authUser.role === "superadmin"
                    ? await projects.findOne({ where: { id } })
                    : await projects.findOne({ where: { id, organization_id: authUser.organization_id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        if (authUser.role === "client") {
            if (requestedRole && requestedRole !== "client") {
                return res.status(403).json({ error: "Only client share links are available" });
            }

            const membership = await project_members.findOne({
                where: {
                    project_id: id,
                    user_id: authUser.user_id,
                    role: "client",
                },
            });

            if (!membership) {
                return res.status(403).json({ error: "Not authorized to view share links for this project" });
            }

            return res.status(200).json({
                clientLink: `${FRONTEND_URL}/auth/login-redirect?role=client&code=${project.client_code}`,
                clientCode: project.client_code,
            });
        }

        if (authUser.role !== "admin" && authUser.role !== "superadmin") {
            return res.status(403).json({ error: "Only admins can get share links" });
        }

        const response: any = {};
        
        if (!requestedRole || requestedRole === 'contributor') {
            response.contributorLink = `${FRONTEND_URL}/auth/login-redirect?role=contributor&code=${project.contributor_code}`;
            response.contributorCode = project.contributor_code;
        }
        
        if (!requestedRole || requestedRole === 'client') {
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

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const project = await projects.findOne({ where: { id } });
        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        const isSameOrgAdmin = authUser.role === "admin" && Number(project.organization_id) === Number(authUser.organization_id);
        const isSuperadmin = authUser.role === "superadmin";

        if (!isSuperadmin && !isSameOrgAdmin) {
            const membership = await project_members.findOne({
                where: {
                    project_id: id,
                    user_id: authUser.user_id,
                    role: authUser.role,
                },
            });

            if (!membership) {
                return res.status(403).json({ error: "Not authorized to view project members" });
            }
        }

        const members = await project_members.findAll({
            where: { project_id: id },
            include: [{
                model: users,
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

export const removeProjectMember = async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
        const { id: projectId, userId } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            await t.rollback();
            return res.status(403).json({ error: "Only admins can remove project members" });
        }

        const project = await projects.findOne({
            where: { id: projectId, organization_id: authUser.organization_id },
            transaction: t as any,
        });
        if (!project) {
            await t.rollback();
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        const membership = await project_members.findOne({
            where: { project_id: projectId, user_id: userId },
            transaction: t as any,
        });

        if (!membership) {
            await t.rollback();
            return res.status(404).json({ error: "Project member not found" });
        }

        const memberRole = (membership as any).role;
        if (memberRole !== 'contributor' && memberRole !== 'client') {
            await t.rollback();
            return res.status(400).json({ error: "Only contributors and clients can be removed" });
        }

        await project_members.destroy({
            where: { project_id: projectId, user_id: userId },
            transaction: t as any,
        });

        const projectRooms = await rooms.findAll({
            where: { project_id: projectId },
            attributes: ['id'],
            transaction: t as any,
        });

        const roomIds = projectRooms.map((room: any) => room.id);
        if (roomIds.length > 0) {
            await room_members.destroy({
                where: { user_id: userId, room_id: { [Op.in]: roomIds } },
                transaction: t as any,
            });
        }

        await notifications.destroy({
            where: { user_id: userId, project_id: projectId },
            transaction: t as any,
        });

        try {
            getIO().to(`project-${projectId}`).emit('project-stats-updated', { projectId: String(projectId) });
        } catch (ioErr) {
            console.error('Socket emit error (non-fatal):', ioErr);
        }

        await t.commit();
        return res.status(200).json({ message: "Project member removed successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Remove Project Member Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
