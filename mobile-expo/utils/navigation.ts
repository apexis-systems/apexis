import { Router } from 'expo-router';

/**
 * Centrally handles navigation logic for various notification types.
 * Works for both in-app notification clicks and system push notification interactions.
 */
export const handleNotificationNavigation = (type: string, data: any, router: Router) => {
    // Standardize data extraction (handles both snake_case and camelCase)
    const projectId = data?.projectId || data?.project_id;
    const roomId = data?.roomId || data?.room_id;
    
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

    switch (type) {
        case 'file_upload':
        case 'file_visibility':
        case 'folder_visibility':
        case 'file_upload_admin':
            router.push(`/(tabs)/project/${projectId}?tab=documents`);
            break;
        case 'photo_upload':
        case 'photo_comment':
            router.push(`/(tabs)/project/${projectId}?tab=photos`);
            break;
        case 'snag_assigned':
        case 'snag_creation_admin':
        case 'snag_status_update':
            router.push(`/(tabs)/project/${projectId}?tab=snags`);
            break;
        case 'rfi_created':
        case 'rfi_assigned':
        case 'rfi_status_update':
        case 'rfi_comment':
            router.push(`/(tabs)/project/${projectId}?tab=rfi`);
            break;
        case 'member_joined':
            router.push(`/(tabs)/project/${projectId}`);
            break;
        default:
            // Fallback to project overview
            router.push(`/(tabs)/project/${projectId}`);
            break;
    }
};
