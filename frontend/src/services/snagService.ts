import { PrivateAxios } from "@/helpers/PrivateAxios";

export type SnagStatus = 'amber' | 'green' | 'red';

export interface ConversationMessage {
    id: number;
    item_type: 'rfi' | 'snag';
    item_id: number;
    project_id: number;
    sender_id: number;
    text?: string | null;
    attachment_type?: 'image' | 'audio' | null;
    file_url?: string | null;
    file_name?: string | null;
    file_type?: string | null;
    file_size?: string | null;
    downloadUrl?: string | null;
    createdAt: string;
    updatedAt: string;
    sender?: { id: number; name: string; role?: string; profile_pic?: string | null };
}

export interface Snag {
    id: number;
    project_id: number;
    title: string;
    description?: string;
    photo_url?: string;
    audio_url?: string | null;
    assigned_to?: number;
    status: SnagStatus;
    response?: string;
    created_by?: number;
    assignee?: { id: number; name: string; email: string };
    creator?: { id: number; name: string };
    photoDownloadUrl?: string;
    audioDownloadUrl?: string | null;
    responsePhotoUrls?: string[];
    response_photos?: string[];
    createdAt: string;
    seen_at?: string | null;
    folder_ids?: number[];
    linked_folders?: { id: number; name: string; folder_type: string }[];
}

export interface Assignee {
    id: number;
    name: string;
    email: string;
    role: string;
}

export const getSnags = async (projectId: number | string): Promise<Snag[]> => {
    const res = await PrivateAxios.get('/snags', { params: { project_id: projectId } });
    return res.data.snags;
};

export const createSnag = async (form: FormData): Promise<Snag> => {
    const res = await PrivateAxios.post('/snags', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.snag;
};

export const updateSnagStatus = async (id: number, form: FormData): Promise<Snag> => {
    const res = await PrivateAxios.patch(`/snags/${id}/status`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.snag;
};

export const updateSnag = async (id: number, form: FormData): Promise<Snag> => {
    const res = await PrivateAxios.patch(`/snags/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.snag;
};

export const deleteSnag = async (id: number): Promise<void> => {
    await PrivateAxios.delete(`/snags/${id}`);
};

export const getAssignees = async (projectId: number | string): Promise<Assignee[]> => {
    const res = await PrivateAxios.get('/snags/assignees', { params: { project_id: projectId } });
    return res.data.assignees;
};

export const markSnagSeen = async (id: number): Promise<{ seen_at: string }> => {
    const res = await PrivateAxios.patch(`/snags/${id}/seen`);
    return res.data;
};

export const getFolderSnags = async (folderId: string | number): Promise<Snag[]> => {
    const res = await PrivateAxios.get(`/snags/folder/${folderId}`);
    return res.data.snags;
};

export const getSnagMessages = async (id: number): Promise<ConversationMessage[]> => {
    const res = await PrivateAxios.get(`/snags/${id}/messages`);
    return res.data.messages || [];
};

export const sendSnagMessage = async (id: number, form: FormData): Promise<ConversationMessage> => {
    const res = await PrivateAxios.post(`/snags/${id}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.message;
};
