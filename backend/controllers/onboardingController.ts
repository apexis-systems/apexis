import type { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";
import redis from "../config/redis.ts";
import { users, organizations, plans } from "../models/index.ts";
import { Op } from "sequelize";
import { sendEmail } from "../utils/email.ts";
import { normalizePhone, isValidPhone, isIndianPhone } from "../utils/sms.ts";


const OTP_TTL = 300; // 5 minutes
const appLogoPath = fileURLToPath(new URL("../assets/app-icon.png", import.meta.url));

const buildAdminOtpEmail = (name: string, organizationName: string, otp: string) => {
    const safeName = name || "there";
    const safeOrganization = organizationName || "your project";

    const text = [
        `Hello ${safeName},`,
        "",
        "Welcome to APEXISpro.",
        "Your construction communication platform.",
        "",
        `To access project "${safeOrganization}" on APEXISpro as an "Admin", your verification code is: ${otp}`,
        "",
        "This code is valid for 5 minutes.",
    ].join("\n");

    const html = `
        <div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <div style="padding:32px 32px 20px;border-bottom:1px solid #eef2f7;background:#ffffff;">
                    <div style="display:flex;align-items:center;gap:20px;">
                        <img src="cid:apexis-app-icon" alt="Apexispro logo" width="56" height="56" style="display:block;border-radius:14px;" />
                        <div style="margin-left:16px;">
                            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#0f172a;">APEXISpro</div>
                            <div style="font-size:14px;line-height:1.5;color:#475569;">Record.Report.Release.</div>
                        </div>
                    </div>
                </div>
                <div style="padding:32px;">
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Hello ${safeName},</p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                        Welcome to <strong>APEXISpro</strong>.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        Your construction communication platform.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        To access project <strong>"${safeOrganization}"</strong> on APEXISpro as an <strong>"Admin"</strong>, your verification code is:
                    </p>
                    <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                        <div style="font-size:34px;line-height:1.2;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</div>
                    </div>
                    <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#64748b;">
                        This code is valid for 5 minutes.
                    </p>
                </div>
            </div>
        </div>
    `;

    return {
        html,
        text,
        attachments: [
            {
                filename: "app-icon.png",
                path: appLogoPath,
                cid: "apexis-app-icon",
            },
        ],
    };
};

// ==========================
// SUPERADMIN ONBOARDING
// ==========================

export const superadminRequestOtp = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await users.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("OTP", otp);
        const otpHash = await bcrypt.hash(otp, 10);

        const redisKey = `otp:signup:superadmin:${email}`;
        await redis.set(
            redisKey,
            JSON.stringify({ otp_hash: otpHash, name, password_hash: passwordHash }),
            "EX",
            OTP_TTL
        );

        await sendEmail(
            email,
            "Your SuperAdmin Verification Code",
            `Hello ${name},\n\nYour OTP for registration is: ${otp}\n\nIt is valid for 5 minutes.`
        );

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        console.error("SuperAdmin Request OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const superadminVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const redisKey = `otp:signup:superadmin:${email}`;

        const redisDataStr = await redis.get(redisKey);
        if (!redisDataStr) {
            return res.status(400).json({ error: "OTP expired or invalid" });
        }

        const { otp_hash, name, password_hash } = JSON.parse(redisDataStr);

        const isOtpValid = await bcrypt.compare(otp, otp_hash);
        if (!isOtpValid) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        const superAdminCount = await users.count({ where: { role: "superadmin" } });
        const isPrimary = superAdminCount === 0;

        // Superadmins don't belong to any specific organization
        const newUser = await users.create({
            organization_id: null,
            name,
            email,
            password: password_hash,
            role: "superadmin",
            is_primary: isPrimary,
            email_verified: true,
        });

        await redis.del(redisKey);

        const token = jwt.sign(
            {
                user_id: newUser.id,
                name: newUser.name,
                role: newUser.role,
                organization_id: newUser.organization_id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );

        res.status(201).json({ message: "Signup successful", token });
    } catch (error) {
        console.error("SuperAdmin Verify OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================
// ADMIN ONBOARDING
// ==========================

export const adminRequestOtp = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, password, organization_name, verification_method } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ error: "Email or Phone is required" });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ error: "Invalid phone number. Please include your country code (e.g. +971501234567)." });
        }

        const normalizedPhone = phone ? normalizePhone(phone) : null;
        const normalizedEmail = email ? email.toLowerCase() : null;

        const existingUser = await users.findOne({
            where: {
                [Op.or]: [
                    normalizedEmail ? { email: normalizedEmail } : null,
                    normalizedPhone ? { phone_number: normalizedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

        if (existingUser && existingUser.role === "admin") {
            return res.status(400).json({ error: "Email or Phone already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("OTP", otp);
        const otpHash = await bcrypt.hash(otp, 10);

        const identifier = (verification_method === 'phone' && normalizedPhone) ? normalizedPhone : (normalizedEmail || normalizedPhone);
        const redisKey = `otp:signup:admin:${identifier}`;
        await redis.set(
            redisKey,
            JSON.stringify({
                otp_hash: otpHash,
                name,
                email: normalizedEmail,
                phone: normalizedPhone,
                password_hash: passwordHash,
                organization_name
            }),
            "EX",
            OTP_TTL
        );

        const method = verification_method || (phone ? 'phone' : 'email');

        if (method === 'phone' && normalizedPhone) {
            // Guard: phone OTP (Fast2SMS) only works for Indian numbers
            if (!isIndianPhone(normalizedPhone)) {
                await redis.del(redisKey);
                return res.status(400).json({
                    error: "Phone OTP is only supported for Indian numbers. Please use email verification."
                });
            }
            const { sendOTP } = await import("../utils/sms.ts");
            await sendOTP(normalizedPhone, otp);
        } else if (method === 'email' && email) {
            const adminOtpEmail = buildAdminOtpEmail(name, organization_name, otp);
            await sendEmail(
                email,
                "Your Apexispro Admin Access Code",
                adminOtpEmail.html,
                {
                    isHtml: true,
                    text: adminOtpEmail.text,
                    attachments: adminOtpEmail.attachments,
                }
            );
        } else {
            return res.status(400).json({ error: "Selected verification method is unavailable" });
        }

        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Admin Request OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const adminVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, phone, otp, verification_method } = req.body;
        const normalizedPhone = phone ? normalizePhone(phone) : null;
        const normalizedEmail = email ? email.toLowerCase() : null;
        const identifier = (verification_method === 'phone' && normalizedPhone) ? normalizedPhone : (normalizedEmail || normalizedPhone);
        const redisKey = `otp:signup:admin:${identifier}`;

        const redisDataStr = await redis.get(redisKey);
        if (!redisDataStr) {
            return res.status(400).json({ error: "OTP expired or invalid" });
        }

        const { otp_hash, name, email: savedEmail, phone: savedPhone, password_hash, organization_name } = JSON.parse(redisDataStr);

        const isOtpValid = await bcrypt.compare(otp, otp_hash);
        if (!isOtpValid) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + 60);

        // Find the Freemium plan (synced from our seeds)
        let plan = await plans.findOne({ 
            where: { name: "Freemium" } 
        });

        // Fallback: create it if it somehow doesn't exist yet
        if (!plan) {
            plan = await plans.create({
                name: "Freemium",
                price: 0,
                storage_limit_mb: 500,
                duration_days: 60,
                project_limit: 1,
                contributor_limit: 2,
                client_limit: 1,
                max_snags: 15,
                max_rfis: 15,
                can_export_reports: false,
                can_share_media: false,
                can_export_handover: false
            });
        }

        const [organization] = await organizations.findOrCreate({
            where: { name: organization_name },
            defaults: {
                plan_id: plan.id,
                plan_name: plan.name,
                plan_price: plan.price,
                plan_start_date: now,
                plan_end_date: endDate,
                storage_limit_mb: plan.storage_limit_mb
            }
        });

        const adminCount = await users.count({
            where: {
                organization_id: organization.id,
                role: "admin"
            }
        });
        const isPrimary = adminCount === 0;

        // Check if user already exists (e.g. they were a contributor/client)
        let user = await users.findOne({
            where: {
                [Op.or]: [
                    savedEmail ? { email: savedEmail } : null,
                    savedPhone ? { phone_number: savedPhone } : null
                ].filter(Boolean) as any[]
            }
        });

        if (user) {
            await user.update({
                organization_id: organization.id,
                name,
                password: password_hash,
                role: "admin",
                is_primary: isPrimary,
                email_verified: user.email_verified || !!savedEmail,
                phone_verified: user.phone_verified || !!savedPhone,
            });
        } else {
            user = await users.create({
                organization_id: organization.id,
                name,
                email: savedEmail,
                phone_number: savedPhone,
                password: password_hash,
                role: "admin",
                is_primary: isPrimary,
                email_verified: !!savedEmail,
                phone_verified: !!savedPhone,
            });
        }

        const newUser = user; // for downstream consistency

        await redis.del(redisKey);

        const token = jwt.sign(
            {
                user_id: newUser.id,
                name: newUser.name,
                role: newUser.role,
                organization_id: newUser.organization_id
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "30d" }
        );

        res.status(201).json({ message: "Signup successful", token });
    } catch (error) {
        console.error("Admin Verify OTP Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
