import type { Request, Response } from "express";
import { users } from "../models/index.ts";

export const inviteUser = async (req: Request, res: Response) => {
    try {
        const { role, email } = req.body;
        const authUser = (req as any).user;

        if (!authUser || authUser.role !== "admin") {
            return res.status(403).json({ error: "Only admins can invite users" });
        }

        if (!["contributor", "admin", "client"].includes(role)) {
            return res.status(400).json({ error: "Invalid role specified" });
        }

        // Check if user already exists
        const existingUser = await users.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email" });
        }

        const newUser = await users.create({
            organization_id: authUser.organization_id,
            name: "Invited User", // Could optionally be provided in body
            email,
            role,
            is_primary: false,
            email_verified: false,
            // Passwords wait for a "set password" flow if required. 
            // For now, setting it to null or random hash for DB constraints if `allowNull` is false
            // According to migration, password `allowNull` is true
        });

        // TODO: Send invite email with a link for the user to set their password

        res.status(201).json({ message: "User invited successfully", user: newUser });
    } catch (error) {
        console.error("Invite User Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
