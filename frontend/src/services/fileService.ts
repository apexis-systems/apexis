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

export const getFiles = async (projectId: string | number, folder_type?: string, search?: string) => {
    try {
        let url = `/files/${projectId}`;
        const params = new URLSearchParams();
        if (folder_type) params.append('folder_type', folder_type);
        if (search) params.append('search', search);
        
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await PrivateAxios.get(url);
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
    return updateFile(fileId, { client_visible });
};

export const toggleDoNotFollow = async (fileId: string | number, do_not_follow: boolean) => {
    return updateFile(fileId, { do_not_follow });
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

export const updateFile = async (fileId: string | number, data: { file_name?: string, folder_id?: string | null, client_visible?: boolean, do_not_follow?: boolean }) => {
    try {
        const response = await PrivateAxios.put(`/files/${fileId}`, data);
        return response.data;
    } catch (error) {
        console.error("updateFile Error", error);
        throw error;
    }
};

export const archiveFile = async (fileId: string | number) => {
    try {
        const response = await PrivateAxios.put(`/files/${fileId}/archive`);
        return response.data;
    } catch (error) {
        console.error("archiveFile Error", error);
        throw error;
    }
};
