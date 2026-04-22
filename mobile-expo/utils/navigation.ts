import { Router } from 'expo-router';
import * as Notifications from 'expo-notifications';

/**
 * Module-level singleton — tracks the last notification ID that was navigated.
 * Shared across ALL components (unlike per-component useRef), so even if both
 * _layout.tsx (useLastNotificationResponse) and index.tsx
 * (addNotificationResponseReceivedListener) fire for the same background tap,
 * only the FIRST caller navigates and the second is silently ignored.
 */
let _lastHandledNotificationId: string | null = null;

/**
 * Entry point for notification taps. Use this in all components instead of
 * calling handleNotificationNavigation directly. Provides cross-component
 * deduplication via the module-level singleton above.
 */
export const navigateFromNotification = (
    notificationId: string,
    type: string | undefined | null,
    data: any,
    router: Router
) => {
    if (!notificationId || _lastHandledNotificationId === notificationId) {
        console.log(`[NAV] Notification ${notificationId} already handled — skipping.`);
        return;
    }
    _lastHandledNotificationId = notificationId;
    
    // Clear the native notification badge when the user interacts with a notification
    Notifications.setBadgeCountAsync(0).catch(err => {
        console.warn('Failed to clear badge count:', err);
    });

    handleNotificationNavigation(type, data, router);
};

/**
 * Core navigation logic for all notification types.
 * Handles deep-linking to chats, project tabs (documents, photos, snags, RFI).
 * Robust against null/undefined data — a malformed FCM payload never crashes the app.
 */
export const handleNotificationNavigation = (type: string | undefined | null, data: any, router: Router) => {
    try {
        console.log(`[NAV] handleNotificationNavigation called. type: "${type}"`, JSON.stringify(data, null, 2));

        if (!type || !data) {
            console.warn('[NAV] handleNotificationNavigation called with no type or data — skipping.');
            return;
        }

        // Standardize data extraction (handles both snake_case and camelCase)
        const projectId = data?.projectId || data?.project_id;
        const roomId = data?.roomId || data?.room_id;
        const folderId = data?.folderId || data?.folder_id;
        const fileId = data?.fileId || data?.file_id;
        const photoId = data?.photoId || data?.photo_id;
        const snagId = data?.snagId || data?.snag_id;
        const rfiId = data?.rfiId || data?.rfi_id;

        console.log(`[NAV] Navigating for notification type=${type}`, data);

        if (type === 'chat' || type === 'group_creation') {
            router.push(roomId ? `/chat/${roomId}` : `/(tabs)/chat`);
            return;
        }

        if (!projectId) {
            console.warn('[NAV] No projectId in notification data — skipping project navigation.');
            return;
        }

        let tab = 'overview';
        let extraParams = '';

        switch (type) {
            case 'file_upload':
            case 'file_visibility':
            case 'folder_visibility':
            case 'file_upload_admin':
            case 'upload':              // generic upload activity type
                tab = 'documents';
                if (folderId) extraParams += `&initialFolderId=${folderId}`;
                if (fileId) extraParams += `&fileId=${fileId}`;
                break;
            case 'photo_upload':
            case 'photo_comment':
            case 'upload_photo':        // alternate upload activity type
            case 'comment':             // comment on a photo
            case 'mention':             // user mentioned in a photo comment
                tab = 'photos';
                if (folderId) extraParams += `&initialFolderId=${folderId}`;
                if (fileId) extraParams += `&fileId=${fileId}`;
                if (photoId) extraParams += `&photoId=${photoId}`;
                break;
            case 'snag_assigned':
            case 'snag_creation_admin':
            case 'snag_status_update':
            case 'snag_comment':
            case 'snag_created':
                tab = 'snags';
                if (snagId) extraParams += `&snagId=${snagId}`;
                break;
            case 'rfi_created':
            case 'rfi_assigned':
            case 'rfi_status_update':
            case 'rfi_comment':
                tab = 'rfi';
                if (rfiId) extraParams += `&rfiId=${rfiId}`;
                break;
            case 'member_joined':
            default:
                tab = 'overview';
                break;
        }

        router.push(`/(tabs)/project/${projectId}?tab=${tab}${extraParams}` as any);
    } catch (err) {
        console.error('[NAV] Unexpected error during notification navigation:', err);
    }
};
