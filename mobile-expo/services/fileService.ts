import { PrivateAxios } from '../helpers/PrivateAxios';

export const uploadFile = async (data: FormData) => {
    try {
        const response = await PrivateAxios.post('/files/upload', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 120000
        });
        return response.data;
    } catch (error) {
        console.error("uploadFile Error", error);
        throw error;
    }
};

export const uploadFileWithProgress = async (
    data: FormData,
    onProgress: (percentage: number) => void
) => {
    try {
        const response = await PrivateAxios.post('/files/upload', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 120000,
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const pct = Math.min(100, Math.round((progressEvent.loaded * 100) / progressEvent.total));
                    onProgress(pct);
                }
            },
        });
        return response.data;
    } catch (error) {
        console.error("uploadFileWithProgress Error", error);
        throw error;
    }
};

export const uploadScans = async (
    data: FormData,
    onProgress: (percentage: number) => void
) => {
    try {
        const response = await PrivateAxios.post('/files/upload-scans', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                const total = progressEvent.total || 1;
                const p = Math.min(Math.round((progressEvent.loaded / total) * 100), 100);
                onProgress(p);
            }
        });
        return response.data;
    } catch (error) {
        console.error("uploadScans Error", error);
        throw error;
    }
};

export const getProjectFiles = async (projectId: string | number, folder_type?: string, search?: string) => {
    try {
        let url = `/files/${projectId}`;
        const params: string[] = [];
        if (folder_type) params.push(`folder_type=${folder_type}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        
        if (params.length > 0) url += `?${params.join('&')}`;
        
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("getProjectFiles Error", error);
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

export const getSecureFileUrl = async (fileKey: string) => {
    try {
        const response = await PrivateAxios.post('/files/view', { fileKey }, {
            responseType: 'arraybuffer'
        });

        // Convert arraybuffer to base64 for React Native Image component
        const base64 = btoa(
            new Uint8Array(response.data).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                '',
            ),
        );

        const contentType = response.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error("getSecureFileUrl Error", error);
        return null;
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

export const unarchiveFile = async (fileId: string | number, folder_id?: string | null) => {
    try {
        const response = await PrivateAxios.put(`/files/${fileId}/unarchive`, { folder_id });
        return response.data;
    } catch (error) {
        console.error("unarchiveFile Error", error);
        throw error;
    }
};
