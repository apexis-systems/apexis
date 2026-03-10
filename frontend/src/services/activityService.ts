import { PrivateAxios } from '@/helpers/PrivateAxios';
import { ActivityItem } from '@/types';

export const getActivities = async (organization_id?: string): Promise<ActivityItem[]> => {
    try {
        const url = organization_id ? `/activities?organization_id=${organization_id}` : '/activities';
        const res = await PrivateAxios.get(url);
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
