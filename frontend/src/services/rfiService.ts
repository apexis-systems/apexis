import { PrivateAxios } from "@/helpers/PrivateAxios";

export type RFIStatus = 'open' | 'closed' | 'overdue';

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

export interface RFIAssignee {
    id: number;
    name: string;
    role: string;
    profile_pic?: string;
}

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
    created_at?: string;
    updated_at?: string;
    assignee?: { id: number; name: string; role: string; profile_pic?: string };
    creator?: { id: number; name: string; role: string; profile_pic?: string };
    photoDownloadUrls?: string[];
    expiry_date?: string;
    response?: string;
    response_photos?: string[];
    responsePhotoUrls?: string[];
    linked_folders?: { id: number; name: string; folder_type: string }[];
    seen_at?: string | null;
    folder_ids?: number[];
    file_rfi_links?: any[];
}

export const getRFIs = async (projectId: number | string): Promise<RFI[]> => {
    const res = await PrivateAxios.get('/rfis', { params: { project_id: projectId } });
    return res.data.rfis;
};

export const getRFIAssignees = async (projectId: number | string): Promise<RFIAssignee[]> => {
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

export const updateRFIResponse = async (id: number, form: FormData): Promise<RFI> => {
    const res = await PrivateAxios.patch(`/rfis/${id}/response`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.rfi;
};

export const deleteRFI = async (id: number): Promise<void> => {
    await PrivateAxios.delete(`/rfis/${id}`);
};

export const updateRFI = async (id: number, form: FormData): Promise<RFI> => {
    const res = await PrivateAxios.patch(`/rfis/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.rfi;
};

export const getFolderRFIs = async (folderId: number | string): Promise<RFI[]> => {
    const res = await PrivateAxios.get(`/rfis/folder/${folderId}`);
    return res.data.rfis;
};

export const markRFISeen = async (id: number): Promise<{ seen_at: string }> => {
    const res = await PrivateAxios.patch(`/rfis/${id}/seen`);
    return res.data;
};

export const getRFIMessages = async (id: number): Promise<ConversationMessage[]> => {
    const res = await PrivateAxios.get(`/rfis/${id}/messages`);
    return res.data.messages || [];
};

export const sendRFIMessage = async (id: number, form: FormData): Promise<ConversationMessage> => {
    const res = await PrivateAxios.post(`/rfis/${id}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.message;
};

export const linkRfiFile = async (id: number, fileId: number): Promise<any> => {
    const res = await PrivateAxios.post(`/rfis/${id}/link`, { fileId });
    return res.data;
};

export const deleteRfiLink = async (id: number, fileId: number): Promise<void> => {
    await PrivateAxios.delete(`/rfis/${id}/link/${fileId}`);
};
