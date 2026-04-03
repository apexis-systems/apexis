import { PrivateAxios } from "@/helpers/PrivateAxios";

export type RFIStatus = 'open' | 'closed' | 'overdue';

export interface RFI {
    id: number;
    project_id: number;
    title: string;
    description: string;
    status: RFIStatus;
    assigned_to: number | null;
    created_by: number;
    is_client_visible: boolean;
    photos: string[];
    createdAt: string;
    updatedAt: string;
    assignee?: { id: number; name: string; role: string; profile_pic?: string };
    creator?: { id: number; name: string; role: string; profile_pic?: string };
    photoDownloadUrls?: string[];
    expiry_date?: string;
    response?: string;
}

export const getRFIs = async (projectId: number | string): Promise<RFI[]> => {
    const res = await PrivateAxios.get('/rfis', { params: { project_id: projectId } });
    return res.data.rfis;
};

export const getRFIAssignees = async (projectId: number | string): Promise<any[]> => {
    const res = await PrivateAxios.get('/rfis/assignees', { params: { project_id: projectId } });
    return res.data.assignees;
};

export const createRFI = async (form: FormData): Promise<RFI> => {
    const res = await PrivateAxios.post('/rfis', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.rfi;
};

export const updateRFIStatus = async (id: number, status: RFIStatus): Promise<void> => {
    await PrivateAxios.patch(`/rfis/${id}/status`, { status });
};

export const getRFIById = async (id: number): Promise<RFI> => {
    const res = await PrivateAxios.get(`/rfis/${id}`);
    return res.data.rfi;
};

export const updateRFIResponse = async (id: number, data: { response?: string; status?: RFIStatus }): Promise<RFI> => {
    const res = await PrivateAxios.patch(`/rfis/${id}/response`, data);
    return res.data.rfi;
};
