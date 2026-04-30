import type { Request, Response } from 'express';

export const getSystemConfig = async (req: Request, res: Response) => {
    try {
        const config = {
            minAppVersion: process.env.MIN_APP_VERSION || '1.0.0',
            androidStoreUrl: process.env.ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.apexis.app',
            iosStoreUrl: process.env.IOS_STORE_URL || 'https://apps.apple.com/in/app/apexispro/id6760482687',
        };

        res.status(200).json({
            success: true,
            data: config
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: "Error fetching system config",
            error: error.message
        });
    }
};
