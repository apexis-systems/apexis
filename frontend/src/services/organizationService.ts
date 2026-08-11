import { PrivateAxios } from '@/helpers/PrivateAxios';

export const uploadOrganizationLogo = async (formData: FormData) => {
    try {
        const response = await PrivateAxios.post('/organizations/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error("uploadOrganizationLogo Error", error);
        throw error;
    }
};

export const updateOrganization = async (data: { name?: string; restrict_onboarding?: boolean }) => {
    try {
        const response = await PrivateAxios.patch('/organizations', data);
        return response.data;
    } catch (error) {
        console.error("updateOrganization Error", error);
        throw error;
    }
};

export const getOrgPhotosPaginated = async (page: number = 1, limit: number = 36, orgId?: string, projectId?: string, sort?: string) => {
    try {
        let url = `/organizations/photos?page=${page}&limit=${limit}`;
        if (orgId) url += `&organization_id=${orgId}`;
        if (projectId && projectId !== 'all') url += `&project_id=${projectId}`;
        if (sort) url += `&sort=${sort}`;
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("getOrgPhotosPaginated Error", error);
        throw error;
    }
};
