export type UserRole = 'superadmin' | 'admin' | 'contributor' | 'client';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active?: boolean;
}

export interface Project {
    id: string;
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    color: string;
    totalDocs: number;
    totalPhotos: number;
    assignedTo: string[];
    sharedWith: string[];
}

export interface Folder {
    id: string;
    projectId: string;
    name: string;
    type: 'documents' | 'photos';
}

export interface ProjectDocument {
    id: string;
    projectId: string;
    folderId: string;
    name: string;
    type: 'pdf' | 'dwg';
    uploadDate: string;
    uploader: string;
    uploaderId: string;
    version: number;
    clientVisible: boolean;
    size: string;
}

export interface ProjectPhoto {
    id: string;
    projectId: string;
    folderId: string;
    url: string;
    date: string;
    location: string;
    tags: string[];
    uploader: string;
    uploaderId: string;
    clientVisible: boolean;
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
}

export interface ManualSOP {
    id: string;
    projectId: string;
    name: string;
    type: string;
    uploadDate: string;
    uploader: string;
    uploaderId: string;
    size: string;
}
