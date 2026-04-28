import { PrivateAxios } from '../helpers/PrivateAxios';

export const getProjects = async (organization_id?: string, deleted: boolean = false) => {
    try {
        let url = '/projects';
        const params: string[] = [];
        if (organization_id) params.push(`organization_id=${organization_id}`);
        if (deleted) params.push('deleted=true');
        
        if (params.length > 0) url += `?${params.join('&')}`;
        
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("fetchProjects Error", error);
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

export const updateProject = async (id: string, data: any) => {
    try {
        const response = await PrivateAxios.patch(`/projects/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("updateProject Error", error);
        throw error;
    }
};

export const exportHandoverPackage = async (id: string | number) => {
    try {
        const response = await PrivateAxios.post(`/projects/${id}/export-handover`);
        return response.data;
    } catch (error) {
        console.error("exportHandoverPackage Error", error);
        throw error;
    }
};

export const getLatestExport = async (id: string | number) => {
    try {
        const response = await PrivateAxios.get(`/projects/${id}/export-handover`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getProjectShareLinks = async (id: string | number, role?: string) => {
    try {
        const url = role ? `/projects/${id}/share-links?role=${role}` : `/projects/${id}/share-links`;
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("getProjectShareLinks Error", error);
        throw error;
    }
};

export const getProjectMembers = async (id: string | number) => {
    try {
        const response = await PrivateAxios.get(`/projects/${id}/members`);
        return response.data;
    } catch (error) {
        console.error("getProjectMembers Error", error);
        throw error;
    }
};

export const getMemberForTag = async (id: string | number) =>{
    try{
        const response = await PrivateAxios.get(`/projects/${id}/members-for-tagging`)
        return response.data;
    }catch(error){
        console.error("getMemberForTag Error", error);
        throw error;
    }
}

export const removeProjectMember = async (projectId: string | number, userId: string | number) => {
    try {
        const response = await PrivateAxios.delete(`/projects/${projectId}/members/${userId}`);
        return response.data;
    } catch (error) {
        console.error("removeProjectMember Error", error);
        throw error;
    }
};

export const deleteProject = async (id: string | number, force: boolean = false) => {
    try {
        const url = force ? `/projects/${id}?force=true` : `/projects/${id}`;
        const response = await PrivateAxios.delete(url);
        return response.data;
    } catch (error) {
        console.error("deleteProject Error", error);
        throw error;
    }
};

export const restoreProject = async (id: string | number) => {
    try {
        const response = await PrivateAxios.post(`/projects/${id}/restore`);
        return response.data;
    } catch (error) {
        console.error("restoreProject Error", error);
        throw error;
    }
};
