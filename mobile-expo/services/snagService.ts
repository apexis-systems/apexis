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
    last_comment?: string;
    createdAt: string;
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

export const getAssignees = async (projectId: number | string): Promise<Assignee[]> => {
    const res = await PrivateAxios.get('/snags/assignees', { params: { project_id: projectId } });
    return res.data.assignees;
};

export const createSnag = async (data: FormData): Promise<Snag> => {
    const res = await PrivateAxios.post('/snags', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.snag;
};

export const updateSnagStatus = async (id: number, status: SnagStatus): Promise<void> => {
    await PrivateAxios.patch(`/snags/${id}/status`, { status });
};

export const deleteSnagApi = async (id: number): Promise<void> => {
    await PrivateAxios.delete(`/snags/${id}`);
};
