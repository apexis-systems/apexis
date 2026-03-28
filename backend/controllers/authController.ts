import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { users, organizations, project_members, projects } from "../models/index.ts";
import { Op } from "sequelize";
import redis from "../config/redis.ts";
import { sendEmail } from "../utils/email.ts";

export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const user = await users.findOne({
            where: {
                [Op.or]: [
                    email ? { email: email.toLowerCase() } : null,
                    phone ? { phone_number: phone } : null
                ].filter(Boolean) as any[]
            }
        });

        if (!user || user.role !== "admin") {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { user_id: user.id, name: user.name, role: user.role, organization_id: user.organization_id },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );


        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: user.role } });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const projectLogin = async (req: Request, res: Response) => {
    try {
        const { email, phone, code } = req.body;

        if (!code) {
            return res.status(400).json({ error: "Project code is required" });
        }

        // Try to find project by contributor_code OR client_code
        const project = await projects.findOne({
            where: {
                [Op.or]: [
                    { contributor_code: code },
                    { client_code: code }
                ]
            }
        });

        if (!project) {
            return res.status(404).json({ error: "Invalid project code" });
        }

        if (!email && !phone) {
            return res.status(400).json({ error: "Email or Phone number is required" });
        }

        let user = await users.findOne({
            where: {
                organization_id: project.organization_id,
                [Op.or]: [
                    email ? { email: email.toLowerCase() } : null,
                    phone ? { phone_number: phone } : null
                ].filter(Boolean) as any[]
            }
        });

        const roleForCode = project.contributor_code === code ? 'contributor' : 'client';
        let isNewUser = false;

        if (!user) {
            // Auto-create user because they have valid project code and no signup is required
            user = await users.create({
                organization_id: project.organization_id,
                name: "Pending",
                email: email ? email.toLowerCase() : null,
                phone_number: phone || null,
                role: roleForCode,
                email_verified: !!email,
                phone_verified: !!phone,
                is_primary: false
            });
            isNewUser = true;
        }

        // Verify if user is already a member of this project
        const membership = await project_members.findOne({
            where: {
                project_id: project.id,
                user_id: user.id
            }
        });

        if (!membership) {
            // Auto-add them to the project since they possess the valid project code
            await project_members.create({
                project_id: project.id,
                user_id: user.id,
                role: roleForCode
            });
        }

        const token = jwt.sign(
            { user_id: user.id, name: user.name, role: user.role, organization_id: user.organization_id, project_id: project.id },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );


        res.status(200).json({ 
            token, 
            user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: user.role },
            isPendingName: user.name === "Pending" || !user.name || user.name.trim() === ""
        });
    } catch (error) {
        console.error("Project Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const superadminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await users.findOne({ where: { email: email.toLowerCase(), role: "superadmin" } });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { user_id: user.id, name: user.name, role: "superadmin" },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "24h" }
        );


        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number, role: "superadmin" } });
    } catch (error) {
        console.error("Superadmin Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const me = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const user = await users.findByPk(authUser.user_id, {
            attributes: ['id', 'name', 'email', 'phone_number', 'role', 'organization_id', 'profile_pic']
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        const organization = user.organization_id ? await organizations.findByPk(user.organization_id) : null;

        res.status(200).json({
            user,
            organization
        });
    } catch (error) {
        console.error("Me Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const verifyInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const decoded: any = jwt.verify(token as string, process.env.JWT_SECRET || "default_secret");
        res.status(200).json({ email: decoded.email, role: decoded.role || 'admin' });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const completeOnboarding = async (req: Request, res: Response) => {
    try {
        const { token, name, password } = req.body;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

        const updateData: any = {
            name,
            email_verified: true
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await users.update(updateData, { where: { id: decoded.user_id } });

        res.status(200).json({ message: "Account setup complete" });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const verifyOnboardingToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const decoded: any = jwt.verify(token as string, process.env.JWT_SECRET || "default_secret");
        if (decoded.type !== "public_onboarding") throw new Error("Invalid token type");

        res.status(200).json({ role: decoded.role, organization_id: decoded.organization_id });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const completePublicSignup = async (req: Request, res: Response) => {
    try {
        const { token, name, email, phone, project_code } = req.body;
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

        if (decoded.type !== "public_onboarding") throw new Error("Invalid token type");

        if (!email && !phone) return res.status(400).json({ error: "Email or Phone is required" });
        if (!project_code) return res.status(400).json({ error: "Project code is required" });

        // Find project by code
        const project = await projects.findOne({
            where: {
                organization_id: decoded.organization_id,
                [Op.or]: [
                    { contributor_code: project_code },
                    { client_code: project_code }
                ]
            }
        });

        if (!project) return res.status(404).json({ error: "Invalid project code" });

        // Create user
        const newUser = await users.create({
            organization_id: decoded.organization_id,
            name,
            email: email?.toLowerCase() || null,
            phone_number: phone || null,
            role: decoded.role,
            email_verified: !!email,
            phone_verified: !!phone,
            is_primary: false
        });

        // Add to project
        await project_members.create({
            project_id: project.id,
            user_id: newUser.id,
            role: decoded.role
        });

        res.status(201).json({ message: "Signup complete" });
    } catch (error) {
        console.error("Public Signup Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const forgotPasswordRequestOtp = async (req: Request, res: Response) => {
    try {
        const { email, role } = req.body;
        const user = await users.findOne({ where: { email: email.toLowerCase(), role } });

        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);

        await redis.set(`otp:forgot:${email}`, otpHash, "EX", 600);
        await sendEmail(email, "Password Reset OTP", `Your OTP for password reset is: ${otp}`);

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const forgotPasswordVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const normalizedEmail = email.toLowerCase();
        const savedOtpHash = await redis.get(`otp:forgot:${normalizedEmail}`);

        if (!savedOtpHash || !(await bcrypt.compare(otp, savedOtpHash))) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        const resetToken = jwt.sign({ email: normalizedEmail }, process.env.JWT_SECRET || "default_secret", { expiresIn: "15m" });
        await redis.del(`otp:forgot:${normalizedEmail}`);

        res.status(200).json({ resetToken });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { resetToken, newPassword } = req.body;
        const decoded: any = jwt.verify(resetToken, process.env.JWT_SECRET || "default_secret");

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await users.update({ password: passwordHash }, { where: { email: decoded.email } });

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        res.status(400).json({ error: "Invalid or expired reset token" });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { currentPassword, newPassword } = req.body;

        const user = await users.findByPk(authUser.user_id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect current password" });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await users.update({ password: passwordHash }, { where: { id: user.id } });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};
