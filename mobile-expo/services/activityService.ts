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

export const createActivity = async (payload: { project_id: string; type: string; description: string; metadata?: string | object }) => {
    try {
        // If metadata is a string (JSON-encoded), decode it first so backend receives an object
        const body: any = { ...payload };
        if (typeof payload.metadata === 'string') {
            try { body.metadata = JSON.parse(payload.metadata); } catch { /* keep as string */ }
        }
        const res = await PrivateAxios.post('/activities', body);
        return res.data;
    } catch (error) {
        console.error('createActivity API error:', error);
        throw error;
    }
};
