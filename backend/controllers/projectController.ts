import type { Request, Response } from "express";
import crypto from "crypto";
import { startExportProcess, activeExports } from "../services/exportService.ts";
import s3Client, { BUCKET_NAME } from "../config/s3Config.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { projects, users, folders, files, organizations, project_members, room_members, rooms, notifications, manuals, snags, rfis, comments, activities, reports, chat_messages, blocked_users, sequelize, Sequelize } from "../models/index.ts";
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

        if (name && name.length > 35) {
            return res.status(400).json({ error: "Project name cannot exceed 35 characters" });
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
            restrict_onboarding: req.body.restrict_onboarding !== undefined ? req.body.restrict_onboarding : false,
        });

        // Create default folders (Photo & Doc types)
        const folderNames = [
            "3D images", "Architectural", "Automation",
            "Brick marking", "Carpentry", "Electrical", "Fabrication",
            "Flooring", "HVAC", "Interiors", "Landscape",
            "Permit", "Plumbing", "Structural", "Confidential"
        ];

        const folderCreationTasks: any[] = [];
        folderNames.forEach((name) => {
            const isConfidential = name.toLowerCase() === 'confidential';
            // Create for Photos
            folderCreationTasks.push(folders.create({
                project_id: newProject.id,
                name,
                created_by: authUser.user_id,
                client_visible: isConfidential ? false : true,
                folder_type: "photo",
            }));
            // Create for Docs
            folderCreationTasks.push(folders.create({
                project_id: newProject.id,
                name,
                created_by: authUser.user_id,
                client_visible: isConfidential ? false : true,
                folder_type: "document",
            }));
        });

        // Extra SOPs folder for Documents only
        folderCreationTasks.push(folders.create({
            project_id: newProject.id,
            name: "SOPs",
            created_by: authUser.user_id,
            client_visible: true,
            folder_type: "document",
        }));

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

        const { organization_id: queryOrgId, deleted, search } = req.query;
        const activeOrgId = authUser.organization_id;
        const activeRole = authUser.role;
        const isTrash = deleted === 'true';

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
        } else if (activeRole === 'contributor' || activeRole === 'client' || activeRole === 'consultant' || activeRole === 'vendor') {
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

        if (isTrash) {
            whereCondition.deletedAt = { [Op.ne]: null };
        }

        if (search) {
            whereCondition[Op.and] = [
                ...(whereCondition[Op.and] || []),
                {
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${search}%` } },
                        { description: { [Op.iLike]: `%${search}%` } }
                    ]
                }
            ];
        }

        let totalPhotosQuery: any;
        let totalDocsQuery: any;
        let totalFoldersQuery: any;

        if (activeRole === 'client') {
            totalPhotosQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT "id" FROM "folders" WHERE "folders"."project_id" = "projects"."id" AND "folders"."client_visible" = true) AND "files"."client_visible" = true AND "files"."file_type" LIKE 'image/%')`),
                'totalPhotos'
            ];
            totalDocsQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT "id" FROM "folders" WHERE "folders"."project_id" = "projects"."id" AND "folders"."client_visible" = true) AND "files"."client_visible" = true AND "files"."file_type" NOT LIKE 'image/%')`),
                'totalDocs'
            ];
            totalFoldersQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "folders" WHERE "folders"."project_id" = "projects"."id" AND "folders"."client_visible" = true)`),
                'totalFolders'
            ];
        } else if (activeRole === 'consultant' || activeRole === 'vendor') {
            totalPhotosQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT pmf."folder_id" FROM "project_member_folders" pmf JOIN "project_members" pm ON pmf."project_member_id" = pm."id" WHERE pm."user_id" = ${authUser.user_id} AND pm."project_id" = "projects"."id") AND "files"."file_type" LIKE 'image/%')`),
                'totalPhotos'
            ];
            totalDocsQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT pmf."folder_id" FROM "project_member_folders" pmf JOIN "project_members" pm ON pmf."project_member_id" = pm."id" WHERE pm."user_id" = ${authUser.user_id} AND pm."project_id" = "projects"."id") AND "files"."file_type" NOT LIKE 'image/%')`),
                'totalDocs'
            ];
            totalFoldersQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "folders" WHERE "folders"."id" IN (SELECT pmf."folder_id" FROM "project_member_folders" pmf JOIN "project_members" pm ON pmf."project_member_id" = pm."id" WHERE pm."user_id" = ${authUser.user_id} AND pm."project_id" = "projects"."id"))`),
                'totalFolders'
            ];
        } else {
            totalPhotosQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT "id" FROM "folders" WHERE "folders"."project_id" = "projects"."id") AND "files"."file_type" LIKE 'image/%')`),
                'totalPhotos'
            ];
            totalDocsQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "files" WHERE "files"."folder_id" IN (SELECT "id" FROM "folders" WHERE "folders"."project_id" = "projects"."id") AND "files"."file_type" NOT LIKE 'image/%')`),
                'totalDocs'
            ];
            totalFoldersQuery = [
                literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "folders" WHERE "folders"."project_id" = "projects"."id")`),
                'totalFolders'
            ];
        }

        const result = await projects.findAll({
            where: whereCondition,
            paranoid: !isTrash,
            attributes: {
                include: [
                    totalPhotosQuery,
                    totalDocsQuery,
                    totalFoldersQuery,
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" IN ('contributor', 'consultant', 'vendor'))`),
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
                    attributes: ['id', 'name', 'restrict_onboarding'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        // Strip sensitive codes for non-admins and calculate daysRemaining for trash
        const safeRows = result.map((p: any) => {
            const json = p.toJSON();
            if (authUser.role !== 'admin') {
                delete json.contributor_code;
                delete json.client_code;
            }

            // Calculate days remaining if in trash
            if (isTrash && json.deletedAt) {
                const deletedDate = new Date(json.deletedAt);
                const expiryDate = new Date(deletedDate);
                expiryDate.setDate(deletedDate.getDate() + 30);

                const now = new Date();
                const diffTime = expiryDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                json.daysRemaining = Math.max(0, diffDays);
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
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" IN ('contributor', 'consultant', 'vendor'))`),
                        'totalContributors'
                    ],
                    [
                        literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "project_members" pm WHERE pm."project_id" = "projects"."id" AND pm."role" = 'client')`),
                        'totalClients'
                    ]
                ]
            },
            include: [
                {
                    model: organizations,
                    as: 'organization',
                    attributes: ['id', 'name', 'restrict_onboarding']
                }
            ]
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

        if (["contributor", "client", "consultant", "vendor"].includes(authUser.role)) {
            // Check if user is a member of this project in the database with the active role
            const membership = await project_members.findOne({
                where: { project_id: project.id, user_id: authUser.user_id, role: authUser.role }
            });
            if (!membership) {
                return res.status(403).json({ error: "Forbidden: Not assigned to this project" });
            }
        }

        let projectOutput = project.toJSON ? project.toJSON() : project;
        const restrictOnboarding = !!projectOutput.restrict_onboarding || !!projectOutput.organization?.restrict_onboarding;

        // Strip sensitive codes by role:
        // - admin/superadmin: can see both codes
        // - contributor: can see contributor_code only (unless restricted onboarding is active)
        // - client: can see client_code only (unless restricted onboarding is active)
        // - consultant/vendor: can see neither code
        if (authUser.role === "contributor") {
            delete projectOutput.client_code;
            if (restrictOnboarding) {
                delete projectOutput.contributor_code;
            }
        } else if (authUser.role === "client") {
            delete projectOutput.contributor_code;
            if (restrictOnboarding) {
                delete projectOutput.client_code;
            }
        } else if (["consultant", "vendor"].includes(authUser.role)) {
            delete projectOutput.contributor_code;
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
        const { name, description, start_date, end_date, restrict_onboarding } = req.body;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can update projects" });
        }

        const project = await projects.findOne({ where: { id, organization_id: authUser.organization_id } });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        if (name && name.length > 35) {
            return res.status(400).json({ error: "Project name cannot exceed 35 characters" });
        }

        if (description && description.length > 50) {
            return res.status(400).json({ error: "Project description cannot exceed 50 characters" });
        }

        await project.update({
            name: name || project.name,
            description: description || project.description,
            start_date: start_date || project.start_date,
            end_date: end_date || project.end_date,
            restrict_onboarding: restrict_onboarding !== undefined ? restrict_onboarding : project.restrict_onboarding,
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
            ["client", "contributor", "consultant", "vendor"].includes(authUser.role)
                ? await projects.findByPk(id, { include: [{ model: organizations, as: 'organization', attributes: ['id', 'restrict_onboarding'] }] })
                : authUser.role === "superadmin"
                    ? await projects.findOne({ where: { id }, include: [{ model: organizations, as: 'organization', attributes: ['id', 'restrict_onboarding'] }] })
                    : await projects.findOne({ where: { id, organization_id: authUser.organization_id }, include: [{ model: organizations, as: 'organization', attributes: ['id', 'restrict_onboarding'] }] });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        const restrictOnboarding = !!project.restrict_onboarding || !!project.organization?.restrict_onboarding;

        // Non-admin roles: each role can share their own type of link
        if (["client", "contributor", "consultant", "vendor"].includes(authUser.role)) {
            const memberRole = authUser.role as string;

            const membership = await project_members.findOne({
                where: {
                    project_id: id,
                    user_id: authUser.user_id,
                    role: memberRole,
                },
            });

            if (!membership) {
                return res.status(403).json({ error: "Not authorized to view share links for this project" });
            }

            if (["consultant", "vendor"].includes(authUser.role)) {
                return res.status(403).json({ error: "Consultants and vendors cannot share project links" });
            }

            if (restrictOnboarding) {
                return res.status(403).json({ error: "Onboarding is restricted. Only administrators can onboard users." });
            }

            if (authUser.role === "client") {
                // Client can share client link
                const shareUrl = `${FRONTEND_URL}/auth/login-redirect?role=client&code=${project.client_code}`;
                return res.status(200).json({
                    clientLink: shareUrl,
                    clientCode: project.client_code,
                });
            }

            // contributor — can share the contributor join link
            const shareUrl = `${FRONTEND_URL}/auth/login-redirect?role=contributor&code=${project.contributor_code}`;
            return res.status(200).json({
                contributorLink: shareUrl,
                contributorCode: project.contributor_code,
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


export const getMemberForTag = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const project = await projects.findOne({
            where: { id },
            include: [{
                model: users,
                attributes: ['id', 'name']
            }]
        });

        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        const members = await project_members.findAll({
            where: { project_id: id },
            include: [{
                model: users,
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']]
        });

        // Create a pseudo-member for the creator/admin
        const creatorMember = {
            user: (project as any).user,
            role: 'admin'
        };

        // Combine creator with other members
        const allMembers = [creatorMember, ...members];

        res.status(200).json({ members: allMembers });
    } catch (error) {
        console.error("Get Project Members for tagging Error:", error);
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
        if (memberRole !== 'contributor' && memberRole !== 'client' && memberRole !== 'vendor' && memberRole !== 'consultant') {
            await t.rollback();
            return res.status(400).json({ error: "Only contributors, clients, vendors, and consultants can be removed" });
        }

        const userToBlock = await users.findByPk(userId, { transaction: t as any });

        if (req.query.block === 'true' && userToBlock) {
            // 1. Add to blocked list
            if (userToBlock.email || userToBlock.phone_number) {
                const whereClause: any = { organization_id: authUser.organization_id };
                if (userToBlock.email && userToBlock.phone_number) {
                    whereClause[Op.or] = [
                        { email: userToBlock.email },
                        { phone_number: userToBlock.phone_number }
                    ];
                } else if (userToBlock.email) {
                    whereClause.email = userToBlock.email;
                } else {
                    whereClause.phone_number = userToBlock.phone_number;
                }
                const existingBlocked = await blocked_users.findOne({ where: whereClause, transaction: t as any });
                if (!existingBlocked) {
                    await blocked_users.create({
                        organization_id: authUser.organization_id,
                        email: userToBlock.email || null,
                        phone_number: userToBlock.phone_number || null
                    }, { transaction: t as any });
                }
            }

            // 2. Identify projects owned by the Admin's organization
            const ownedProjects = await projects.findAll({
                where: { organization_id: authUser.organization_id },
                attributes: ['id'],
                transaction: t as any
            });
            const ownedProjectIds = ownedProjects.map((p: any) => p.id);

            // 3. Find memberships for this user in THESE projects
            const memberships = await project_members.findAll({
                where: { 
                    user_id: userId,
                    project_id: { [Op.in]: ownedProjectIds }
                },
                attributes: ['project_id'],
                transaction: t as any,
            });
            const affectedProjectIds = memberships.map((m: any) => m.project_id);

            // 4. Remove memberships and associated data ONLY for these projects
            await project_members.destroy({ 
                where: { 
                    user_id: userId, 
                    project_id: { [Op.in]: ownedProjectIds }
                }, 
                transaction: t as any 
            });
            
            if (ownedProjectIds.length > 0) {
                await room_members.destroy({ 
                    where: { 
                        user_id: userId,
                        room_id: {
                            [Op.in]: Sequelize.literal(`(SELECT id FROM rooms WHERE project_id IN (${ownedProjectIds.join(',')}))`)
                        }
                    }, 
                    transaction: t as any 
                });

                // Nullify assignees for tasks in these projects
                await snags.update({ assigned_to: null }, { 
                    where: { 
                        assigned_to: userId,
                        project_id: { [Op.in]: ownedProjectIds }
                    }, 
                    transaction: t as any 
                });
                
                await rfis.update({ assigned_to: null }, { 
                    where: { 
                        assigned_to: userId,
                        project_id: { [Op.in]: ownedProjectIds }
                    }, 
                    transaction: t as any 
                });
            }

            // 5. Remove from organization (un-link)
            if (userToBlock.organization_id === authUser.organization_id) {
                await userToBlock.update({ organization_id: null }, { transaction: t as any });
            }

            // 6. Notify affected projects
            for (const pId of affectedProjectIds) {
                try {
                    getIO().to(`project-${pId}`).emit('project-stats-updated', { projectId: String(pId) });
                } catch (ioErr) {
                    console.error('Socket emit error (non-fatal):', ioErr);
                }
            }
        } else {
            // Normal remove project member logic
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
        }

        await t.commit();
        return res.status(200).json({ message: "Project member removed successfully" });
    } catch (error) {
        await t.rollback();
        console.error("Remove Project Member Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { force } = req.query; // If force=true, perform permanent delete
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            await t.rollback();
            return res.status(403).json({ error: "Only admins can delete projects" });
        }

        const project = await projects.findOne({
            where: { id, organization_id: authUser.organization_id },
            transaction: t,
            paranoid: false // Find even if already soft-deleted
        });

        if (!project) {
            await t.rollback();
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        if (force === 'true') {
            const { permanentlyDeleteProject } = await import('../services/projectService.ts');
            await permanentlyDeleteProject(Number(id), authUser.organization_id);
            return res.status(200).json({ message: "Project permanently deleted" });
        } else {
            // --- SOFT DELETE LOGIC ---
            await project.destroy({ transaction: t });
            await t.commit();
            return res.status(200).json({ message: "Project moved to trash" });
        }
    } catch (error) {
        if (t) await t.rollback();
        console.error("Delete Project Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const restoreProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can restore projects" });
        }

        const project = await projects.findOne({
            where: { id, organization_id: authUser.organization_id },
            paranoid: false
        });

        if (!project) {
            return res.status(404).json({ error: "Project not found or not authorized" });
        }

        if (!project.deletedAt) {
            return res.status(400).json({ error: "Project is not in trash" });
        }

        await project.restore();
        res.status(200).json({ message: "Project restored successfully", project });
    } catch (error) {
        console.error("Restore Project Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
