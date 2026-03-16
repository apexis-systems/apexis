import { PrivateAxios } from '../helpers/PrivateAxios';

export const getProjects = async () => {
    try {
        const response = await PrivateAxios.get('/projects');
        return response.data;
    } catch (error) {
        console.error("fetchProjects Error", error);
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

export const updateProject = async (id: string, data: any) => {
    try {
        const response = await PrivateAxios.patch(`/projects/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("updateProject Error", error);
        throw error;
    }
};
