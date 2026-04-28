import { PrivateAxios } from '@/helpers/PrivateAxios';

export type SnagStatus = 'amber' | 'green' | 'red';

export interface Snag {
    id: number;
    project_id: number;
    title: string;
    description?: string;
    photo_url?: string;
    photoDownloadUrl?: string;
    assigned_to?: number;
    assignee?: { id: number; name: string; email: string };
    creator?: { id: number; name: string };
    status: SnagStatus;
    response?: string;
    createdAt: string;
    created_by?: number;
    responsePhotoUrls?: string[];
    response_photos?: string[] | null;
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

