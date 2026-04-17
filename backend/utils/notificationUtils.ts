import { notifications, users } from '../models/index.ts';
import { messaging } from '../config/firebase.ts';
import { getIO } from '../socket.ts';

export const sendNotification = async ({
    userId,
    title,
    body,
    type,
    data = {},
    projectId
}: {
    userId: number;
    title: string;
    body: string;
    type: string;
    data?: any;
    projectId?: number;
}) => {
    try {
        // 1. In-App Notification (Save to DB)
        const finalProjectId = projectId || data?.projectId || data?.project_id || null;
        const newNotif = await notifications.create({
            user_id: userId,
            project_id: finalProjectId ? Number(finalProjectId) : null,
            title,
            body,
            type,
            data,
            is_read: false
        });

        // 2. Fetch user for FCM token
        const user = await users.findByPk(userId);

        // 3. Push Notification (FCM) - Only if user has a token AND Firebase is initialized
        if (user?.fcm_token && messaging) {
            try {
                const response = await messaging.send({
                    notification: { title, body },
                    android: {
                        priority: 'high',
                        ttl: 2419200 * 1000, // 4 weeks in milliseconds
                        notification: {
                            channelId: 'default',
                            defaultSound: true,
                            defaultVibrateTimings: true,
                            visibility: 'public',
                            priority: 'high',
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title,
                                    body
                                },
                                sound: 'default',
                                badge: 1,
                                'content-available': 1
                            }
                        },
                        headers: {
                            'apns-priority': '10',
                            'apns-push-type': 'alert'
                        }
                    },
                    data: {
                        ...Object.keys(data).reduce((acc: any, key) => {
                            acc[key] = String(data[key]);
                            return acc;
                        }, {}),
                        title: String(title),
                        body: String(body),
                        type
                    },
                    token: user.fcm_token
                });
                console.log(`Successfully sent FCM message to user ${userId}:`, response);
            } catch (err: any) {
                console.error(`FCM error for user ${userId}:`, err?.code, err?.message);
                if (err?.code === 'messaging/registration-token-not-registered') {
                    console.log(`Token for user ${userId} is stale/unregistered. Clearing...`);
                    await users.update({ fcm_token: null }, { where: { id: userId } });
                }
            }
        }

        // 4. Real-time Socket Emit
        try {
            const io = getIO();
            io.to(`user-${userId}`).emit('new-notification', newNotif);
        } catch (err) {
            console.error(`Socket error for user ${userId}:`, err);
        }

        return newNotif;
    } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
        throw error;
    }
};
