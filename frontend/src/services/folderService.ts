import { PrivateAxios } from "@/helpers/PrivateAxios";

export const getFolders = async (projectId: string) => {
    try {
        const response = await PrivateAxios.get(`/folders?projectId=${projectId}`);
        return response.data;
    } catch (error) {
        console.error("getFolders Error", error);
        throw error;
    }
};

export const createFolder = async (data: { project_id: string, name: string, parent_id?: string | null }) => {
    try {
        const response = await PrivateAxios.post('/folders/create', data);
        return response.data;
    } catch (error) {
        console.error("createFolder Error", error);
        throw error;
    }
};

export const toggleFolderVisibility = async (folderId: string | number, client_visible: boolean) => {
    try {
        const response = await PrivateAxios.put(`/folders/${folderId}/visibility`, { client_visible });
        return response.data;
    } catch (error) {
        console.error("toggleFolderVisibility Error", error);
        throw error;
    }
};

export const bulkUpdateFolders = async (data: { ids: (string | number)[], parent_id?: string | null, client_visible?: boolean }) => {
    try {
        const response = await PrivateAxios.put('/folders/bulk', data);
        return response.data;
    } catch (error) {
        console.error("bulkUpdateFolders Error", error);
        throw error;
    }
};
