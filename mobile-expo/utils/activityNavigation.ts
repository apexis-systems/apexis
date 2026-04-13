import { Router } from 'expo-router';

/**
 * Handles navigation logic for activity feed items in the mobile app.
 */
export const handleActivityNavigation = (act: any, router: Router) => {
    const { type, projectId, metadata } = act;

    // 1. Folder redirection (Files/Photos)
    if (metadata?.folderId) {
        const tab = metadata.type === 'photos' ? 'photos' : 'documents';
        router.push(`/(tabs)/project/${projectId}?tab=${tab}&initialFolderId=${metadata.folderId}` as any);
        return;
    }

    // 2. Type-based redirection
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
        case 'member_joined':
            tab = 'overview';
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
