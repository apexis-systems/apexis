import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { users, organizations, projects, project_members, Sequelize } from "../models/index.ts";
import redis from "../config/redis.ts";
import { sendEmail } from "../utils/email.ts";

const OTP_TTL = 300; // 5 minutes
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
            { expiresIn: "30d" }
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
            { expiresIn: "30d" }
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
            { expiresIn: "30d" }
        );

        res.status(200).json({ token, project_id: project.id, role: user.role });
    } catch (error) {
        console.error("Project Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================
// GET CURRENT USER /me
// ==========================

export const me = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await users.findByPk(authUser.user_id, {
            attributes: { exclude: ['password'] },
            include: [{
                model: organizations,
                attributes: ['id', 'name', 'logo']
            }]
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error("Me Route Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================
// SUPERADMIN INVITATION ONBOARDING
// ==========================

export const verifyInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: "Token is required" });
        }

        const decoded = jwt.verify(token as string, process.env.JWT_SECRET || "default_secret") as any;

        const user = await users.findByPk(decoded.user_id);
        if (!user || user.email !== decoded.email) {
            return res.status(404).json({ error: "Invalid invitation" });
        }

        if (user.email_verified) {
            return res.status(400).json({ error: "Invitation already completed" });
        }

        res.status(200).json({ email: user.email });
    } catch (error) {
        console.error("Verify Invitation Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

export const completeOnboarding = async (req: Request, res: Response) => {
    try {
        const { token, name, password } = req.body;

        if (!token || !name || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any;

        const user = await users.findByPk(decoded.user_id);
        if (!user || user.email !== decoded.email) {
            return res.status(404).json({ error: "Invalid invitation" });
        }

        if (user.email_verified) {
            return res.status(400).json({ error: "Invitation already completed" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await user.update({
            name,
            password: hashedPassword,
            email_verified: true
        });

        res.status(200).json({ message: "Account setup successful! You can now log in." });
    } catch (error) {
        console.error("Complete Onboarding Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
};

// ==========================
// PASSWORD MANAGEMENT
// ==========================

export const forgotPasswordRequestOtp = async (req: Request, res: Response) => {
    try {
        const { email, role } = req.body; // role: 'superadmin' or 'admin'

        if (!email || !role) {
            return res.status(400).json({ error: "Email and role are required" });
        }

        const user = await users.findOne({ where: { email, role } });
        if (!user) {
            return res.status(404).json({ error: "User not found with this role" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Forgot Password OTP for ${email}:`, otp);
        const otpHash = await bcrypt.hash(otp, 10);

        const redisKey = `otp:forgot-password:${email}`;
        await redis.set(
            redisKey,
            JSON.stringify({ otp_hash: otpHash, role }),
            "EX",
            OTP_TTL
        );

        await sendEmail(
            email,
            "Password Reset Verification Code",
            `Your OTP for password reset is: ${otp}\n\nIt is valid for 5 minutes.`
        );

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        console.error("Forgot Password Request OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const forgotPasswordVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const redisKey = `otp:forgot-password:${email}`;

        const redisDataStr = await redis.get(redisKey);
        if (!redisDataStr) {
            return res.status(400).json({ error: "OTP expired or invalid" });
        }

        const { otp_hash, role } = JSON.parse(redisDataStr);

        const isOtpValid = await bcrypt.compare(otp, otp_hash);
        if (!isOtpValid) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        // Issue a short-lived reset token
        const resetToken = jwt.sign(
            { email, role, type: "password_reset" },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "10m" }
        );

        res.status(200).json({ resetToken, message: "OTP verified" });
    } catch (error) {
        console.error("Forgot Password Verify OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ error: "Reset token and new password are required" });
        }

        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "default_secret") as any;
        if (decoded.type !== "password_reset") {
            return res.status(400).json({ error: "Invalid token type" });
        }

        const user = await users.findOne({ where: { email: decoded.email, role: decoded.role } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashedPassword });

        // Clear OTP from redis
        await redis.del(`otp:forgot-password:${decoded.email}`);

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(400).json({ error: "Invalid or expired reset token" });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current and new password are required" });
        }

        const user = await users.findByPk(authUser.user_id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashedPassword });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
