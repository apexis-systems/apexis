import { PrivateAxios } from '../helpers/PrivateAxios';

export const getAnalyticsOverview = async () => {
    try {
        const response = await PrivateAxios.get('/analytics');
        return response.data;
    } catch (error: any) {
        console.error("getAnalyticsOverview Error:", error?.response?.data || error.message);
        throw error;
    }
};
