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

export const getDashboardOverview = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/dashboard/overview');
        return response.data;
    } catch (error) {
        console.error("getDashboardOverview Error", error);
        throw error;
    }
};

export const getGrowthAnalytics = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/dashboard/growth');
        return response.data;
    } catch (error) {
        console.error("getGrowthAnalytics Error", error);
        throw error;
    }
};

export const getFreemiumLeads = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/dashboard/leads');
        return response.data;
    } catch (error) {
        console.error("getFreemiumLeads Error", error);
        throw error;
    }
};

export const extendOrganizationTrials = async (organizationIds: (number | string)[], days: number) => {
    try {
        const response = await PrivateAxios.post('/superadmin/organizations/extend-trial', { organizationIds, days });
        return response.data;
    } catch (error) {
        console.error("extendOrganizationTrials Error", error);
        throw error;
    }
};

export const getRevenueAnalytics = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/dashboard/revenue');
        return response.data;
    } catch (error) {
        console.error("getRevenueAnalytics Error", error);
        throw error;
    }
};

export const getOrganizationDetails = async (id: string | number) => {
    try {
        const response = await PrivateAxios.get(`/superadmin/organizations/${id}`);
        return response.data;
    } catch (error) {
        console.error("getOrganizationDetails Error", error);
        throw error;
    }
};

export const getAllUsers = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/users');
        return response.data;
    } catch (error) {
        console.error("getAllUsers Error", error);
        throw error;
    }
};

export const sendBroadcast = async (title: string, description: string) => {
    try {
        const response = await PrivateAxios.post('/superadmin/broadcast', { title, description });
        return response.data;
    } catch (error) {
        console.error("sendBroadcast Error", error);
        throw error;
    }
};

export const getSystemConfig = async () => {
    try {
        const response = await PrivateAxios.get('/system/config');
        return response.data.data;
    } catch (error) {
        console.error("getSystemConfig Error", error);
        throw error;
    }
};

export const updateSystemConfig = async (minAppVersion: string) => {
    try {
        const response = await PrivateAxios.put('/superadmin/system-config', { minAppVersion });
        return response.data;
    } catch (error) {
        console.error("updateSystemConfig Error", error);
        throw error;
    }
};
