import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { users, organizations, projects, project_members, Sequelize } from "../models/index.ts";
// ==========================
// SUPERADMIN LOGIN
// ==========================

export const superadminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await users.findOne({ where: { email, role: "superadmin" } });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (!user.email_verified) {
            return res.status(401).json({ error: "Email not verified" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                role: user.role,
                organization_id: user.organization_id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "1d" }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error("SuperAdmin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================
// ADMIN LOGIN
// ==========================

export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await users.findOne({ where: { email, role: "admin" } });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (!user.email_verified) {
            return res.status(401).json({ error: "Email not verified" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                role: user.role,
                organization_id: user.organization_id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "1d" }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================
// PROJECT LOGIN
// ==========================

export const projectLogin = async (req: Request, res: Response) => {
    try {
        const { email, code, name } = req.body;

        if (!code) {
            return res.status(400).json({ error: "Project code is required" });
        }

        // Try to find project by contributor_code OR client_code
        const project = await projects.findOne({
            where: Sequelize.or(
                { contributor_code: code },
                { client_code: code }
            )
        });

        if (!project) {
            return res.status(404).json({ error: "Invalid project code" });
        }

        const isContributorLogin = project.contributor_code === code;
        const isClientLogin = project.client_code === code;

        let user;

        if (isContributorLogin) {
            if (!email) {
                return res.status(400).json({ error: "Email is required for contributor login" });
            }

            const [foundOrCreatedUser] = await users.findOrCreate({
                where: { email },
                defaults: {
                    name: name || email.split('@')[0],
                    role: "contributor",
                    email_verified: true,
                    is_primary: false,
                    organization_id: project.organization_id
                }
            });
            user = foundOrCreatedUser;

            await project_members.findOrCreate({
                where: {
                    project_id: project.id,
                    user_id: user.id,
                    role: "contributor"
                }
            });

        } else if (isClientLogin) {
            if (!name) {
                return res.status(400).json({ error: "Name is required for client login" });
            }

            const [foundOrCreatedUser] = await users.findOrCreate({
                where: { name, role: "client" },
                defaults: {
                    role: "client",
                    email_verified: false,
                    is_primary: false,
                    organization_id: project.organization_id
                }
            });
            user = foundOrCreatedUser;

            await project_members.findOrCreate({
                where: {
                    project_id: project.id,
                    user_id: user.id,
                    role: "client"
                }
            });
        }

        // Issue project-scoped JWT
        const token = jwt.sign(
            {
                user_id: user.id,
                role: user.role, // 'contributor' or 'client'
                organization_id: user.organization_id,
                project_id: project.id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "1d" }
        );

        res.status(200).json({ token, project_id: project.id, role: user.role });
    } catch (error) {
        console.error("Project Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
