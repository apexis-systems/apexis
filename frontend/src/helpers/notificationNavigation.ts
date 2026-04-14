/**
 * Centrally handles navigation logic for web notifications.
 */
export const handleNotificationNavigation = (type: string, data: any, userRole: string, router: any) => {
    const projectId = data?.projectId || data?.project_id;
    const roomId = data?.roomId || data?.room_id;
    
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
    switch (type) {
        case 'file_upload':
        case 'file_visibility':
        case 'folder_visibility':
        case 'file_upload_admin':
            tab = 'documents';
            break;
        case 'photo_upload':
        case 'photo_comment':
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
        case 'daily_report':
        case 'weekly_report':
        case 'monthly_report':
            tab = 'reports';
            break;
    }

    let url = `/${userRole}/project/${projectId}?tab=${tab}`;
    if (data?.folderId) {
        url += `&folderId=${data.folderId}`;
    }
    router.push(url);
};
