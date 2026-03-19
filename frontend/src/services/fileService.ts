import { PrivateAxios } from "@/helpers/PrivateAxios";

export const uploadFile = async (formData: FormData) => {
    try {
        const response = await PrivateAxios.post('/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
        return response.data;
    } catch (error) {
        console.error("uploadFile Error", error);
        throw error;
    }
};

export const getFiles = async (projectId: string | number) => {
    try {
        const response = await PrivateAxios.get(`/files/${projectId}`);
        return response.data;
    } catch (error) {
        console.error("getFiles Error", error);
        throw error;
    }
};

export const deleteFile = async (fileId: string | number) => {
    try {
        const response = await PrivateAxios.delete(`/files/${fileId}`);
        return response.data;
    } catch (error) {
        console.error("deleteFile Error", error);
        throw error;
    }
};

export const toggleFileVisibility = async (fileId: string | number, client_visible: boolean) => {
    try {
        const response = await PrivateAxios.put(`/files/${fileId}/visibility`, { client_visible });
        return response.data;
    } catch (error) {
        console.error("toggleFileVisibility Error", error);
        throw error;
    }
};

export const toggleDoNotFollow = async (fileId: string | number, do_not_follow: boolean) => {
    try {
        const response = await PrivateAxios.patch(`/files/${fileId}/do-not-follow`, { do_not_follow });
        return response.data;
    } catch (error) {
        console.error("toggleDoNotFollow Error", error);
        throw error;
    }
};

export const getSecureFileUrl = async (fileKey: string) => {
    try {
        const response = await PrivateAxios.post('/files/view', { fileKey }, {
            responseType: 'blob'
        });
        return URL.createObjectURL(response.data);
    } catch (error) {
        console.error("getSecureFileUrl Error", error);
        return null;
    }
};

export const bulkUpdateFiles = async (data: { ids: (string | number)[], folder_id?: string | null, client_visible?: boolean, do_not_follow?: boolean }) => {
    try {
        const response = await PrivateAxios.put('/files/bulk', data);
        return response.data;
    } catch (error) {
        console.error("bulkUpdateFiles Error", error);
        throw error;
    }
};
