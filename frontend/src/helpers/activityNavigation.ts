/**
 * Handles navigation logic for activity feed items.
 */
export const handleActivityNavigation = (act: any, navigate: (path: string) => void, userRole: string) => {
    const { type, projectId, metadata } = act;
    const role = userRole || 'admin';

    // 1. Folder redirection (Files/Photos)
    if (metadata?.folderId) {
        const tab = metadata.type === 'photos' ? 'photos' : 'documents';
        navigate(`/${role}/project/${projectId}?tab=${tab}&folderId=${metadata.folderId}`);
        return;
    }

    // 2. Type-based redirection
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
        case 'comment': // Assuming photo comments for now if no metadata, but metadata handles it above
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
