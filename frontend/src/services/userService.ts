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

export const inviteUser = async (data: { email: string, role: string, project_id?: string | number }) => {
    try {
        const response = await PrivateAxios.post('/users/invite', data);
        return response.data;
    } catch (error) {
        console.error("inviteUser Error", error);
        throw error;
    }
};

export const deleteUser = async (id: string | number) => {
    try {
        const response = await PrivateAxios.delete(`/users/${id}`);
        return response.data;
    } catch (error) {
        console.error("deleteUser Error", error);
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
