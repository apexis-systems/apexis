import { PrivateAxios } from '../helpers/PrivateAxios';

export const getFolders = async (projectId: string, folder_type?: string) => {
    try {
        let url = `/folders?projectId=${projectId}`;
        if (folder_type) url += `&folder_type=${folder_type}`;
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("fetchFolders Error", error);
        throw error;
    }
};

export const createFolder = async (data: { project_id: string, name: string, parent_id?: string | null, folder_type?: string | null }) => {
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

export const updateFolder = async (folderId: string | number, name: string) => {
    try {
        const response = await PrivateAxios.put(`/folders/${folderId}`, { name });
        return response.data;
    } catch (error) {
        console.error("updateFolder Error", error);
        throw error;
    }
};

export const deleteFolder = async (folderId: string | number, forceDelete: boolean = false) => {
    try {
        const response = await (PrivateAxios as any).request({
            method: 'delete',
            url: `/folders/${folderId}`,
            data: { forceDelete }
        });
        return response.data;
    } catch (error) {
        console.error("deleteFolder Error", error);
        throw error;
    }
};
