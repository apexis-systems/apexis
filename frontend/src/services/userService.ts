import { PrivateAxios } from '@/helpers/PrivateAxios';

export const getOrgUsers = async () => {
    try {
        const response = await PrivateAxios.get('/users');
        return response.data.users;
    } catch (error) {
        console.error("getOrgUsers Error", error);
        throw error;
    }
};

export const inviteUser = async (data: { email: string, role: string }) => {
    try {
        const response = await PrivateAxios.post('/users/invite', data);
        return response.data;
    } catch (error) {
        console.error("inviteUser Error", error);
        throw error;
    }
};
