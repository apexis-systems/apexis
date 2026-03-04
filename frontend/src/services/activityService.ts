import { PrivateAxios } from '@/helpers/PrivateAxios';
import { ActivityItem } from '@/types';

export const getActivities = async (): Promise<ActivityItem[]> => {
    try {
        const res = await PrivateAxios.get('/activities');
        return res.data.activities;
    } catch (error) {
        console.error('getActivities API error:', error);
        throw error;
    }
};
