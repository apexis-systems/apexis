import { PrivateAxios } from "@/helpers/PrivateAxios";

export type ManualType = 'manual' | 'sop';

export interface Manual {
    id: number;
    project_id: number;
    file_name: string;
    file_url: string;
    file_size_mb: number;
    type: ManualType;
    uploaded_by?: number;
    uploader?: { id: number; name: string };
    downloadUrl?: string;
    createdAt: string;
}

export const getManuals = async (projectId: number | string): Promise<Manual[]> => {
    const res = await PrivateAxios.get('/manuals', { params: { project_id: projectId } });
    return res.data.manuals;
};

export const uploadManual = async (form: FormData): Promise<Manual> => {
    const res = await PrivateAxios.post('/manuals', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.manual;
};

export const deleteManual = async (id: number): Promise<void> => {
    await PrivateAxios.delete(`/manuals/${id}`);
};
