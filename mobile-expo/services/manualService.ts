import { PrivateAxios } from '@/helpers/PrivateAxios';

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
    creator?: { id: number; name: string };
    downloadUrl?: string;
    createdAt: string;
}

export const getManuals = async (projectId: number | string): Promise<Manual[]> => {
    try {
        const res = await PrivateAxios.get('/manuals', { params: { project_id: projectId } });
        return res.data.manuals || [];
    } catch (error) {
        console.error("getManuals Error", error);
        throw error;
    }
};

export const uploadManual = async (form: FormData): Promise<Manual> => {
    try {
        const res = await PrivateAxios.post('/manuals', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.manual;
    } catch (error) {
        console.error("uploadManual Error", error);
        throw error;
    }
};

export const deleteManualApi = async (id: number): Promise<void> => {
    try {
        await PrivateAxios.delete(`/manuals/${id}`);
    } catch (error) {
        console.error("deleteManualApi Error", error);
        throw error;
    }
};

