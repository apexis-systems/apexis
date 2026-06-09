import { PrivateAxios } from '../helpers/PrivateAxios';

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

export const updateNotificationSettings = async (data: { mute_general_notifications: boolean }) => {
    try {
        const response = await PrivateAxios.patch('/users/notification-settings', data);
        return response.data;
    } catch (error) {
        console.error("updateNotificationSettings Error", error);
        throw error;
    }
};

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

export const getChatUsers = () => getOrgUsers('chat');

export const inviteUser = async (data: { email: string, role: string, project_id?: string | number, folders?: (string | number)[] }) => {
    try {
        const response = await PrivateAxios.post('/users/invite', data);
        return response.data;
    } catch (error) {
        console.error("inviteUser Error", error);
        throw error;
    }
};
