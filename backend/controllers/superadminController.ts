import type { Request, Response } from "express";
import { organizations, projects, folders, users } from "../models/index.ts";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.ts";

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
            attributes: ['id', 'name', 'email', 'role', 'is_primary', 'createdAt', 'email_verified']
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

export const inviteSuperAdmin = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { email } = req.body;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // Check if user already exists
        const existingUser = await users.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "User with this email already exists" });
        }

        // Create pending user
        const newUser = await users.create({
            name: "Pending", // Placeholder
            email,
            password: "", // No password yet
            role: "superadmin",
            is_primary: false,
            email_verified: false,
            organization_id: null
        });

        // Generate invitation token
        const token = jwt.sign(
            { user_id: newUser.id, email: newUser.email },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "24h" }
        );

        // Send invitation email
        const onboardingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/superadmin-onboarding?token=${token}`;

        await sendEmail(
            email,
            "Invitation to join Apexis as SuperAdmin",
            `<h1>Welcome to Apexis</h1>
             <p>You have been invited to join the Apexis team as a SuperAdmin.</p>
             <p>Please click the link below to complete your onboarding:</p>
             <a href="${onboardingUrl}">${onboardingUrl}</a>
             <p>This link will expire in 24 hours.</p>`,
            true
        );

        res.status(201).json({ message: "Invitation sent successfully", user: newUser });
    } catch (error) {
        console.error("Invite SuperAdmin Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSuperAdmin = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { id } = req.params;

        if (!authUser || authUser.role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: SuperAdmin access only" });
        }

        const userToDelete = await users.findByPk(id);
        if (!userToDelete) {
            return res.status(404).json({ error: "User not found" });
        }

        if (userToDelete.is_primary) {
            return res.status(400).json({ error: "Cannot delete the primary SuperAdmin" });
        }

        if (userToDelete.id === authUser.user_id) {
            return res.status(400).json({ error: "You cannot delete yourself" });
        }

        await userToDelete.destroy();

        res.status(200).json({ message: "SuperAdmin deleted successfully" });
    } catch (error) {
        console.error("Delete SuperAdmin Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
