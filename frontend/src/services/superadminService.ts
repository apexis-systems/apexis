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
