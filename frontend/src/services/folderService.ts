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
