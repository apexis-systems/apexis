import { PrivateAxios } from "@/helpers/PrivateAxios";

export const getProjects = async () => {
    try {
        const response = await PrivateAxios.get('/projects');
        return response.data;
    } catch (error) {
        console.error("getProjects Error", error);
        throw error;
    }
};

export const createProject = async (data: any) => {
    try {
        const response = await PrivateAxios.post('/projects', data);
        return response.data;
    } catch (error) {
        console.error("createProject Error", error);
        throw error;
    }
};

export const getProjectById = async (id: string) => {
    try {
        const response = await PrivateAxios.get(`/projects/${id}`);
        return response.data.project;
    } catch (error) {
        console.error("getProjectById Error", error);
        throw error;
    }
};
