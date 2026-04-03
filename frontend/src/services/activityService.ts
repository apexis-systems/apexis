import { PrivateAxios } from '@/helpers/PrivateAxios';
import { ActivityItem } from '@/types';

export const getActivities = async (filters: {
    organization_id?: string;
    user_id?: string;
    type?: string;
    project_id?: string;
} = {}): Promise<ActivityItem[]> => {
    try {
        const params = new URLSearchParams();
        if (filters.organization_id) params.append('organization_id', filters.organization_id);
        if (filters.user_id) params.append('user_id', filters.user_id);
        if (filters.type) params.append('type', filters.type);
        if (filters.project_id) params.append('project_id', filters.project_id);

        const url = `/activities?${params.toString()}`;
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
