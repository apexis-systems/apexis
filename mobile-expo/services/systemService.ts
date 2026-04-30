import { PublicAxios } from '../helpers/PrivateAxios';

export const getSystemConfig = async () => {
    try {
        const response = await PublicAxios.get('/system/config');
        return response.data;
    } catch (error: any) {
        console.error("getSystemConfig Error:", error?.response?.data || error.message);
        throw error;
    }
};
