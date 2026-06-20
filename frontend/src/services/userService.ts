import { PrivateAxios } from '@/helpers/PrivateAxios';

export const getOrgUsers = async (purpose?: 'chat' | 'management') => {
    try {
        const url = purpose ? `/users?purpose=${purpose}` : '/users';
        const response = await PrivateAxios.get(url);
        return response.data.users;
    } catch (error) {
        console.error("getOrgUsers Error", error);
        throw error;
    }
};

export const getProjectsUsers = async () => {
    try {
        const response = await PrivateAxios.get('/users/projects-users');
        return response.data.users;
    } catch (error) {
        console.error("getProjectsUsers Error", error);
        throw error;
    }
};

export const getChatUsers = () => getOrgUsers('chat');

export const inviteUser = async (data: { email?: string, phone_number?: string, role: string, project_id?: string | number, folders?: (string | number)[] }) => {
    try {
        const response = await PrivateAxios.post('/users/invite', data);
        return response.data;
    } catch (error) {
        console.error("inviteUser Error", error);
        throw error;
    }
};

export const deleteUser = async (id: string | number, block?: boolean) => {
    try {
        const response = await PrivateAxios.delete(`/users/${id}${block ? '?block=true' : ''}`);
        return response.data;
    } catch (error) {
        console.error("deleteUser Error", error);
        throw error;
    }
};

export const getBlockedUsers = async () => {
    try {
        const response = await PrivateAxios.get('/users/blocked');
        return response.data.blockedUsers;
    } catch (error) {
        console.error("getBlockedUsers Error", error);
        throw error;
    }
};

export const unblockUser = async (id: string | number) => {
    try {
        const response = await PrivateAxios.delete(`/users/blocked/${id}`);
        return response.data;
    } catch (error) {
        console.error("unblockUser Error", error);
        throw error;
    }
};

export const updateUserProfilePic = async (formData: FormData) => {
    try {
        const response = await PrivateAxios.patch('/users/profile-pic', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error("updateUserProfilePic Error", error);
        throw error;
    }
};

export const updateUserName = async (data: { name: string }) => {
    try {
        const response = await PrivateAxios.patch('/users/name', data);
        return response.data;
    } catch (error) {
        console.error("updateUserName Error", error);
        throw error;
    }
};

export const getOnboardingLinks = async () => {
    try {
        const response = await PrivateAxios.get('/users/onboarding-links');
        return response.data;
    } catch (error) {
        console.error("getOnboardingLinks Error", error);
        throw error;
    }
};
