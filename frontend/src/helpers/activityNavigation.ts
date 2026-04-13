/**
 * Handles navigation logic for activity feed items.
 */
export const handleActivityNavigation = (act: any, navigate: (path: string) => void, userRole: string) => {
    const { type, projectId, metadata } = act;
    const role = userRole || 'admin';

    // 1. Folder-level deep redirection
    if (metadata?.folderId) {
        // Standardize type to plural tab name
        const rawType = metadata.type?.toLowerCase();
        const tab = (rawType === 'photo' || rawType === 'photos') ? 'photos' : 'documents';
        
        navigate(`/${role}/project/${projectId}?tab=${tab}&folderId=${metadata.folderId}`);
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
            navigate(`/${role}/project/${projectId}?tab=${tab}`);
            return;
        }
    }

    // 3. Fallback: Type-based redirection using activity type string
    switch (type) {
        case 'upload':
        case 'file_upload':
        case 'file_upload_admin':
        case 'file_visibility':
        case 'folder_visibility':
            navigate(`/${role}/project/${projectId}?tab=documents`);
            break;
        case 'upload_photo':
        case 'photo_upload':
        case 'photo_comment':
        case 'comment': // Default to photos for 'comment' activity string if no metadata caught it
            navigate(`/${role}/project/${projectId}?tab=photos`);
            break;
        case 'snag_assigned':
        case 'snag_creation_admin':
        case 'snag_status_update':
            navigate(`/${role}/project/${projectId}?tab=snags`);
            break;
        case 'rfi_created':
        case 'rfi_assigned':
        case 'rfi_status_update':
        case 'rfi_comment':
            navigate(`/${role}/project/${projectId}?tab=rfi`);
            break;
        case 'member_joined':
            navigate(`/${role}/project/${projectId}?tab=overview`);
            break;
        case 'daily_report':
        case 'weekly_report':
        case 'monthly_report':
            navigate(`/${role}/project/${projectId}?tab=reports`);
            break;
        case 'chat':
        case 'group_creation':
            if (metadata?.roomId) {
                navigate(`/${role}/chats?roomId=${metadata.roomId}`);
            } else {
                navigate(`/${role}/chats`);
            }
            break;
        default:
            // Fallback to project overview
            if (projectId) {
                navigate(`/${role}/project/${projectId}`);
            }
            break;
    }
};
