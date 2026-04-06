import type { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import redis from "../config/redis.ts";
import { users, organizations, plans } from "../models/index.ts";
import { Op } from "sequelize";
import { sendEmail } from "../utils/email.ts";
import { normalizePhone, isValidPhone, isIndianPhone } from "../utils/sms.ts";


const OTP_TTL = 300; // 5 minutes

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

        if (existingUser) {
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
            await sendEmail(
                email,
                "Your Admin Verification Code",
                `Hello ${name},\n\nWelcome to ${organization_name}! Your OTP for registration is: ${otp}\n\nIt is valid for 5 minutes.`
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
        endDate.setDate(now.getDate() + 14);

        const [plan] = await plans.findOrCreate({
            where: { id: 1 },
            defaults: {
                name: "Free Plan",
                price: 0,
                storage_limit_mb: 100,
                duration_days: 14
            }
        });

        const [organization] = await organizations.findOrCreate({
            where: { name: organization_name },
            defaults: {
                plan_id: plan.id, // Default Free Plan ID
                plan_start_date: now,
                plan_end_date: endDate
            }
        });

        const adminCount = await users.count({
            where: {
                organization_id: organization.id,
                role: "admin"
            }
        });
        const isPrimary = adminCount === 0;

        const newUser = await users.create({
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
