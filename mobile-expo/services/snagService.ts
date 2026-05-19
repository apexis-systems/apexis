import { PrivateAxios } from '@/helpers/PrivateAxios';

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
    photoDownloadUrl?: string;
    audioDownloadUrl?: string | null;
    assigned_to?: number;
    assignee?: { id: number; name: string; email: string };
    creator?: { id: number; name: string };
    status: SnagStatus;
    response?: string;
    createdAt: string;
    created_by?: number;
    responsePhotoUrls?: string[];
    response_photos?: string[] | null;
    seen_at?: string | null;
    folder_ids?: number[];
    linked_folders?: any[];
}

export interface Assignee {
    id: number;
    name: string;
    email: string;
    role: string;
}

export const getSnags = async (projectId: number | string): Promise<Snag[]> => {
    try {
        const res = await PrivateAxios.get('/snags', { params: { project_id: projectId } });
        return res.data.snags || [];
    } catch (error) {
        console.error("getSnags Error", error);
        throw error;
    }
};

export const getAssignees = async (projectId: number | string): Promise<Assignee[]> => {
    try {
        const res = await PrivateAxios.get('/snags/assignees', { params: { project_id: projectId } });
        return res.data.assignees || [];
    } catch (error) {
        console.error("getAssignees Error", error);
        throw error;
    }
};

export const createSnag = async (data: FormData): Promise<Snag> => {
    try {
        const res = await PrivateAxios.post('/snags', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.snag;
    } catch (error) {
        console.error("createSnag Error", error);
        throw error;
    }
};

export const updateSnagStatus = async (id: number, formData: FormData): Promise<Snag> => {
    try {
        const res = await PrivateAxios.patch(`/snags/${id}/status`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.snag;
    } catch (error) {
        console.error("updateSnagStatus Error", error);
        throw error;
    }
};

export const updateSnag = async (id: number, formData: FormData): Promise<Snag> => {
    try {
        const res = await PrivateAxios.patch(`/snags/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.snag;
    } catch (error) {
        console.error("updateSnag Error", error);
        throw error;
    }
};

export const deleteSnagApi = async (id: number): Promise<void> => {
    try {
        await PrivateAxios.delete(`/snags/${id}`);
    } catch (error) {
        console.error("deleteSnagApi Error", error);
        throw error;
    }
};

export const markSnagSeen = async (id: number): Promise<{ seen_at: string }> => {
    try {
        const res = await PrivateAxios.patch(`/snags/${id}/seen`);
        return res.data;
    } catch (error) {
        console.error("markSnagSeen Error", error);
        throw error;
    }
};

export const getFolderSnags = async (folderId: string | number): Promise<Snag[]> => {
    try {
        const res = await PrivateAxios.get(`/snags/folder/${folderId}`);
        return res.data.snags || [];
    } catch (error) {
        console.error("getFolderSnags Error", error);
        throw error;
    }
};

export const getSnagMessages = async (id: number): Promise<ConversationMessage[]> => {
    try {
        const res = await PrivateAxios.get(`/snags/${id}/messages`);
        return res.data.messages || [];
    } catch (error) {
        console.error("getSnagMessages Error", error);
        throw error;
    }
};

export const sendSnagMessage = async (id: number, formData: FormData): Promise<ConversationMessage> => {
    try {
        const res = await PrivateAxios.post(`/snags/${id}/messages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.message;
    } catch (error) {
        console.error("sendSnagMessage Error", error);
        throw error;
    }
};
