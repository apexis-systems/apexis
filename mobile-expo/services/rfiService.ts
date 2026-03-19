import { PrivateAxios } from '@/helpers/PrivateAxios';

export interface RFI {
    id: number;
    project_id: number;
    title: string;
    description: string;
    status: 'open' | 'closed' | 'overdue';
    assigned_to: number | null;
    created_by: number;
    is_client_visible: boolean;
    photos: string[];
    createdAt: string;
    updatedAt: string;
    assignee?: { id: number; name: string; role: string; profile_pic?: string };
    creator?: { id: number; name: string; role: string; profile_pic?: string };
    photoDownloadUrls?: string[];
}

export const getRFIs = async (projectId: number): Promise<RFI[]> => {
    const res = await PrivateAxios.get(`/rfis?project_id=${projectId}`);
    return res.data.rfis;
};

export const getRFIAssignees = async (projectId: number): Promise<any[]> => {
    const res = await PrivateAxios.get(`/rfis/assignees?project_id=${projectId}`);
    return res.data.assignees;
};

export const createRFI = async (formData: FormData): Promise<RFI> => {
    const res = await PrivateAxios.post('/rfis', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.rfi;
};

export const updateRFIStatus = async (id: number, status: string): Promise<RFI> => {
    const res = await PrivateAxios.patch(`/rfis/${id}/status`, { status });
    return res.data.rfi;
};

export const getRFIById = async (id: number): Promise<RFI> => {
    const res = await PrivateAxios.get(`/rfis/${id}`);
    return res.data.rfi;
};
