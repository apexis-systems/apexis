import { Router } from 'expo-router';

/**
 * Centrally handles navigation logic for various notification types.
 * Works for both in-app notification clicks and system push notification interactions.
 * Supports deep-linking to exact folder, file, snag, or RFI.
 */
export const handleNotificationNavigation = (type: string, data: any, router: Router) => {
    // Standardize data extraction (handles both snake_case and camelCase)
    const projectId = data?.projectId || data?.project_id;
    const roomId = data?.roomId || data?.room_id;
    const folderId = data?.folderId || data?.folder_id;
    const fileId = data?.fileId || data?.file_id;
    const snagId = data?.snagId || data?.snag_id;
    const rfiId = data?.rfiId || data?.rfi_id;

    console.log(`[NAV] Handling notification navigation: type=${type}`, data);

    if (type === 'chat' || type === 'group_creation') {
        if (roomId) {
            router.push(`/chat/${roomId}`);
        } else {
            router.push(`/(tabs)/chat`);
        }
        return;
    }

    if (!projectId) {
        console.warn('[NAV] No projectId found in notification data, cannot navigate to project subspace');
        return;
    }

    let tab = 'overview';
    let extraParams = '';

    switch (type) {
        case 'file_upload':
        case 'file_visibility':
        case 'folder_visibility':
        case 'file_upload_admin':
            tab = 'documents';
            if (folderId) extraParams += `&initialFolderId=${folderId}`;
            if (fileId) extraParams += `&fileId=${fileId}`;
            break;
        case 'photo_upload':
        case 'photo_comment':
            tab = 'photos';
            if (folderId) extraParams += `&initialFolderId=${folderId}`;
            if (fileId) extraParams += `&fileId=${fileId}`;
            break;
        case 'snag_assigned':
        case 'snag_creation_admin':
        case 'snag_status_update':
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
            tab = 'overview';
            break;
        default:
            tab = 'overview';
            break;
    }

    router.push(`/(tabs)/project/${projectId}?tab=${tab}${extraParams}` as any);
};
