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

        // 3. Push Notification (FCM) - Only if OFFLINE
        if (user?.fcm_token) {
            try {
                await messaging.send({
                    notification: { title, body },
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'default',
                            priority: 'max',
                            sound: 'default',
                            visibility: 'public'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1,
                                'content-available': 1
                            }
                        },
                        headers: {
                            'apns-priority': '10'
                        }
                    },
                    data: {
                        ...Object.keys(data).reduce((acc: any, key) => {
                            acc[key] = String(data[key]);
                            return acc;
                        }, {}),
                        type
                    },
                    token: user.fcm_token
                });
            } catch (err) {
                console.error(`FCM error for user ${userId}:`, err);
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
