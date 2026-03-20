import { PrivateAxios } from '@/helpers/PrivateAxios';

export const getAnalyticsOverview = async (organizationId?: string) => {
    try {
        const url = organizationId ? `/analytics?organization_id=${organizationId}` : '/analytics';
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("getAnalyticsOverview Error", error);
        throw error;
    }
};
