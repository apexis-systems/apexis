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

export const updateOrganization = async (data: { name: string }) => {
    try {
        const response = await PrivateAxios.patch('/organizations', data);
        return response.data;
    } catch (error) {
        console.error("updateOrganization Error", error);
        throw error;
    }
};
