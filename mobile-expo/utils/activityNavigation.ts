import { Router } from 'expo-router';

/**
 * Handles navigation logic for activity feed items in the mobile app.
 */
export const handleActivityNavigation = (act: any, router: Router) => {
    const { type, projectId, metadata } = act;

    // 1. Folder-level deep redirection
    if (metadata?.folderId) {
        const rawType = metadata.type?.toLowerCase();
        const tab = (rawType === 'photo' || rawType === 'photos') ? 'photos' : 'documents';
        router.push(`/(tabs)/project/${projectId}?tab=${tab}&initialFolderId=${metadata.folderId}` as any);
        return;
    }

    // 2. Tab-level redirection based on metadata type (if no folderId)
    if (metadata?.type) {
        const rawType = metadata.type.toLowerCase();
        let tab = 'overview';
        
        if (rawType === 'photo' || rawType === 'photos') tab = 'photos';
        else if (rawType === 'document' || rawType === 'documents') tab = 'documents';
        else if (rawType === 'snag' || rawType === 'snags') tab = 'snags';
        else if (rawType === 'rfi') tab = 'rfi';
        else if (rawType === 'report' || rawType === 'reports') tab = 'reports';

        if (tab !== 'overview') {
            router.push(`/(tabs)/project/${projectId}?tab=${tab}` as any);
            return;
        }
    }

    // 3. Fallback: Type-based redirection using activity type string
    let tab = 'overview';
    switch (type) {
        case 'upload':
        case 'file_upload':
        case 'file_upload_admin':
        case 'file_visibility':
        case 'folder_visibility':
            tab = 'documents';
            break;
        case 'upload_photo':
        case 'photo_upload':
        case 'photo_comment':
        case 'comment':
            tab = 'photos';
            break;
        case 'snag_assigned':
        case 'snag_creation_admin':
        case 'snag_status_update':
            tab = 'snags';
            break;
        case 'rfi_created':
        case 'rfi_assigned':
        case 'rfi_status_update':
        case 'rfi_comment':
            tab = 'rfi';
            break;
        case 'daily_report':
        case 'weekly_report':
        case 'monthly_report':
            tab = 'reports';
            break;
        case 'chat':
        case 'group_creation':
            if (metadata?.roomId) {
                router.push(`/chat/${metadata.roomId}`);
            } else {
                router.push(`/(tabs)/chat`);
            }
            return;
        default:
            tab = 'overview';
            break;
    }

    if (projectId) {
        router.push(`/(tabs)/project/${projectId}?tab=${tab}` as any);
    }
};
