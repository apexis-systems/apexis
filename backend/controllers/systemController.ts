import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'data/systemConfig.json');

// Initialize with a fallback default
let cachedVersion = '1.0.0';

// Helper to load configuration on start
export const initializeSystemConfig = () => {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed.minAppVersion) {
                cachedVersion = parsed.minAppVersion;
            }
        } else {
            // Ensure directory and default file exist
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify({ minAppVersion: cachedVersion }, null, 2), 'utf8');
        }
    } catch (error) {
        console.error("Failed to initialize system version config:", error);
    }
};

// Expose internal cached value
export const getCachedVersion = () => cachedVersion;

// Helper to update dynamic version config
export const saveSystemConfig = async (minAppVersion: string) => {
    cachedVersion = minAppVersion;
    await fs.promises.writeFile(configPath, JSON.stringify({ minAppVersion: cachedVersion }, null, 2), 'utf8');
};

// GET /config (Public)
export const getSystemConfig = async (req: Request, res: Response) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                minAppVersion: cachedVersion,
                androidStoreUrl: process.env.ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.apexis.app',
                iosStoreUrl: process.env.IOS_STORE_URL || 'https://apps.apple.com/in/app/apexispro/id6760482687',
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: "Error fetching system config",
            error: error.message
        });
    }
};
