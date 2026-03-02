import { PrivateAxios } from '../helpers/PrivateAxios';

export const getFolders = async (projectId: string, folderType: string) => {
    try {
        const response = await PrivateAxios.get(`/folders?project_id=${projectId}&type=${folderType}`);
        return response.data;
    } catch (error) {
        console.error("fetchFolders Error", error);
        throw error;
    }
};

export const createFolder = async (folderData: { project_id: string, name: string, type: string }) => {
    try {
        const response = await PrivateAxios.post('/folders/create', folderData);
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
