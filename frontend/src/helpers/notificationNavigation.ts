/**
 * Centrally handles navigation logic for web notifications.
 * Supports deep-linking to exact folder, file, snag, or RFI.
 */
export const handleNotificationNavigation = (type: string, data: any, userRole: string, router: any) => {
    const projectId = data?.projectId || data?.project_id;
    const roomId = data?.roomId || data?.room_id;
    const folderId = data?.folderId || data?.folder_id;
    const fileId = data?.fileId || data?.file_id;
    const snagId = data?.snagId || data?.snag_id;
    const rfiId = data?.rfiId || data?.rfi_id;

    console.log(`[NAV-WEB] Handling notification navigation: type=${type}`, data);

    if (type === 'chat' || type === 'group_creation') {
        if (roomId) {
            router.push(`/${userRole}/chats?roomId=${roomId}`);
        } else {
            router.push(`/${userRole}/chats`);
        }
        return;
    }

    if (!projectId) {
        console.warn('[NAV-WEB] No projectId found in notification data');
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
            if (folderId) extraParams += `&folderId=${folderId}`;
            if (fileId) extraParams += `&fileId=${fileId}`;
            break;
        case 'photo_upload':
        case 'photo_comment':
            tab = 'photos';
            if (folderId) extraParams += `&folderId=${folderId}`;
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
        case 'daily_report':
        case 'weekly_report':
        case 'monthly_report':
            tab = 'reports';
            break;
        default:
            tab = 'overview';
            break;
    }

    router.push(`/${userRole}/project/${projectId}?tab=${tab}${extraParams}`);
};
