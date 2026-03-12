import { PrivateAxios } from '@/helpers/PrivateAxios';

export const getSuperAdmins = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/teams');
        return response.data.teams;
    } catch (error) {
        console.error("getSuperAdmins Error", error);
        throw error;
    }
};

export const getOrgOverview = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/overview');
        return response.data;
    } catch (error) {
        console.error("getOrgOverview Error", error);
        throw error;
    }
};

export const uploadOrgLogo = async (formData: FormData) => {
    try {
        const response = await PrivateAxios.post('/organizations/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error("uploadOrgLogo Error", error);
        throw error;
    }
};

export const getSecureFileUrl = async (fileKey: string) => {
    try {
        const response = await PrivateAxios.post('/files/view', { fileKey }, {
            responseType: 'blob'
        });
        return URL.createObjectURL(response.data);
    } catch (error) {
        console.error("getSecureFileUrl Error", error);
        return null;
    }
};
export const getOrganizations = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/organizations');
        return response.data.organizations;
    } catch (error) {
        console.error("getOrganizations Error", error);
        throw error;
    }
};

export const inviteSuperAdmin = async (email: string) => {
    try {
        const response = await PrivateAxios.post('/superadmin/invite', { email });
        return response.data;
    } catch (error) {
        console.error("inviteSuperAdmin Error", error);
        throw error;
    }
};

export const deleteSuperAdmin = async (id: number | string) => {
    try {
        const response = await PrivateAxios.delete(`/superadmin/teams/${id}`);
        return response.data;
    } catch (error) {
        console.error("deleteSuperAdmin Error", error);
        throw error;
    }
};
