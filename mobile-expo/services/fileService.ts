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

export const getProjectFiles = async (projectId: string | number) => {
    try {
        const response = await PrivateAxios.get(`/files/${projectId}`);
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
    try {
        const response = await PrivateAxios.put(`/files/${fileId}/visibility`, { client_visible });
        return response.data;
    } catch (error) {
        console.error("toggleFileVisibility Error", error);
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

