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

export const createActivity = async (payload: { project_id: string; type: string; description: string }) => {
    try {
        const res = await PrivateAxios.post('/activities', payload);
        return res.data;
    } catch (error) {
        console.error('createActivity API error:', error);
        throw error;
    }
};
