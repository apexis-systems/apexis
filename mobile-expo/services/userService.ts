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

export const getOrgUsers = async () => {
    try {
        const response = await PrivateAxios.get('/users');
        return response.data.users;
    } catch (error) {
        console.error("getOrgUsers Error", error);
        throw error;
    }
};
