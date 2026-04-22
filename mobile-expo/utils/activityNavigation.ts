import { Router } from 'expo-router';

/**
 * Handles navigation logic for activity feed items in the mobile app.
 */
export const handleActivityNavigation = (act: any, router: Router) => {
    let { type, projectId, metadata } = act;

    // Parse metadata if it came back as a string due to database config or fallback
    if (typeof metadata === 'string') {
        try {
            metadata = JSON.parse(metadata);
        } catch (e) {
            console.error('Failed to parse activity metadata string', e);
            metadata = {};
        }
    }

// 1. Unified Deep Redirection Helpers
    const finalProjectId = projectId || act.project_id;
    if (!finalProjectId && !metadata?.roomId) return; // Cannot navigate without project context unless it's chat

    // 2. Folder & File level redirection 
    // Triggered if we have specific metadata indicating where to go
    if (metadata?.type) {
        const rawType = metadata.type.toLowerCase();
        let tab = 'overview';
        let query = '';

        // Determine destination tab
        if (rawType === 'photo' || rawType === 'photos') tab = 'photos';
        else if (rawType === 'document' || rawType === 'documents') tab = 'documents';
        else if (rawType === 'snag' || rawType === 'snags') {
            tab = 'snags';
            if (metadata.snagId) query += `&snagId=${metadata.snagId}`;
        }
        else if (rawType === 'rfi') {
            tab = 'rfi';
            if (metadata.rfiId) query += `&rfiId=${metadata.rfiId}`;
        }
        else if (rawType === 'report' || rawType === 'reports') tab = 'reports';

        // Add file/folder context if it exists
        if (metadata.fileId) query += `&fileId=${metadata.fileId}`;
        
        // Handle folderId (can be null for root, so we check for presence, not just truthiness)
        if (Object.prototype.hasOwnProperty.call(metadata, 'folderId')) {
            const folderVal = metadata.folderId === null ? '' : metadata.folderId;
            query += `&initialFolderId=${folderVal}`;
        }

        if (tab !== 'overview') {
            router.push(`/(tabs)/project/${finalProjectId}?tab=${tab}${query}` as any);
            return;
        }
    }

    // 3. Fallback: Type-based redirection using activity type string
    let tab = 'overview';
    switch (type) {
        case 'upload':
        case 'uploaded':
        case 'file_upload':
        case 'file_upload_admin':
        case 'file_visibility':
        case 'folder_visibility':
            // If it's plural photos type but generic upload type
            if (metadata?.type === 'photos') {
                tab = 'photos';
            } else {
                tab = 'documents';
            }
            break;
        case 'edit':
            if (metadata?.type === 'snags') {
                tab = 'snags';
                const query = metadata.snagId ? `&snagId=${metadata.snagId}` : '';
                router.push(`/(tabs)/project/${finalProjectId}?tab=${tab}${query}` as any);
                return;
            }
            if (metadata?.type === 'rfi') {
                tab = 'rfi';
                const query = metadata.rfiId ? `&rfiId=${metadata.rfiId}` : '';
                router.push(`/(tabs)/project/${finalProjectId}?tab=${tab}${query}` as any);
                return;
            }
            tab = 'overview';
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

    if (finalProjectId) {
        router.push(`/(tabs)/project/${finalProjectId}?tab=${tab}` as any);
    }
};
