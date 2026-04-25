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
    expiry_date?: string;
    response?: string;
    responsePhotoUrls?: string[];
}

export const getRFIs = async (projectId: number): Promise<RFI[]> => {
    try {
        const res = await PrivateAxios.get(`/rfis?project_id=${projectId}`);
        return res.data.rfis || [];
    } catch (error) {
        console.error("getRFIs Error", error);
        throw error;
    }
};

export const getRFIAssignees = async (projectId: number): Promise<any[]> => {
    try {
        const res = await PrivateAxios.get(`/rfis/assignees?project_id=${projectId}`);
        return res.data.assignees || [];
    } catch (error) {
        console.error("getRFIAssignees Error", error);
        throw error;
    }
};

export const createRFI = async (formData: FormData): Promise<RFI> => {
    try {
        const res = await PrivateAxios.post('/rfis', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.rfi;
    } catch (error) {
        console.error("createRFI Error", error);
        throw error;
    }
};

export const updateRFIStatus = async (id: number, status: string): Promise<RFI> => {
    try {
        const res = await PrivateAxios.patch(`/rfis/${id}/status`, { status });
        return res.data.rfi;
    } catch (error) {
        console.error("updateRFIStatus Error", error);
        throw error;
    }
};

export const getRFIById = async (id: number): Promise<RFI> => {
    try {
        const res = await PrivateAxios.get(`/rfis/${id}`);
        return res.data.rfi;
    } catch (error) {
        console.error("getRFIById Error", error);
        throw error;
    }
};

export const updateRFIResponse = async (id: number, formData: FormData): Promise<RFI> => {
    try {
        const res = await PrivateAxios.patch(`/rfis/${id}/response`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.rfi;
    } catch (error) {
        console.error("updateRFIResponse Error", error);
        throw error;
    }
};

export const deleteRFI = async (id: number): Promise<void> => {
    try {
        await PrivateAxios.delete(`/rfis/${id}`);
    } catch (error) {
        console.error("deleteRFI Error", error);
        throw error;
    }
};

export const updateRFI = async (id: number, formData: FormData): Promise<RFI> => {
    try {
        const res = await PrivateAxios.patch(`/rfis/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.rfi;
    } catch (error) {
        console.error("updateRFI Error", error);
        throw error;
    }
};

