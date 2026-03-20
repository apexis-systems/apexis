export type UserRole = 'superadmin' | 'admin' | 'contributor' | 'client';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active?: boolean;
    profile_pic?: string;
    organization?: {
        id: string;
        name: string;
        logo: string;
    };
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    location: string;
    start_date: string;
    end_date: string;
    color: string;
    totalDocs: number;
    totalPhotos: number;
    assignedTo: string[];
    sharedWith: string[];
    contributor_code: string;
    client_code: string;
}

export interface Folder {
    id: string;
    projectId: string;
    name: string;
    type: 'documents' | 'photos';
}
export interface ProjectDocument {
    id: string;
    folder_id: string;
    project_id: string;
    file_name: string;
    file_type: string;
    file_size_mb: number;
    downloadUrl: string;
    created_by: string;
    client_visible: boolean;
    createdAt: string;
    creator?: { id: string; name: string };
}

export interface ProjectPhoto {
    id: string;
    folder_id: string;
    project_id: string;
    file_name: string;
    file_type: string;
    file_size_mb: number;
    downloadUrl: string;
    created_by: string;
    client_visible: boolean;
    createdAt: string;
    location?: string;
    tags?: string[];
    creator?: { id: string; name: string };
}

export interface Report {
    id: string;
    projectId: string;
    title: string;
    type: 'daily' | 'weekly';
    date: string;
    uploader: string;
}

export interface ActivityItem {
    id: string;
    type: 'upload' | 'edit' | 'delete' | 'share' | 'upload_photo';
    description: string;
    projectName: string;
    userName?: string;
    timestamp: string;
}

export interface Comment {
    id: string;
    targetId: string;
    targetType: 'document' | 'photo';
    userId: string;
    userName: string;
    text: string;
    timestamp: string;
    parentId?: string;
}

export type SnagStatus = 'red' | 'amber' | 'green';

export interface SnagItem {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    photoUrl?: string;
    assignedTo: string;
    assignedToName: string;
    status: SnagStatus;
    comments: string[];
    createdAt: string;
    created_by: string;
    creator?: { id: string; name: string };
}

export interface ManualSOP {
    id: string;
    projectId: string;
    name: string;
    type: string;
    uploadDate: string;
    uploader: string;
    uploaded_by: string;
    size: string;
}
