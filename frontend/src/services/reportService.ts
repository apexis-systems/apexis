import { PrivateAxios } from "@/helpers/PrivateAxios";

export interface Report {
    id: number;
    project_id: number;
    type: 'daily' | 'weekly';
    period_start: string;
    period_end: string;
    photos_count: number;
    docs_count: number;
    releases_count: number;
    comments_count: number;
    summary?: string;
    createdAt: string;
}

export const getReports = async (
    projectId: number | string,
    type?: 'daily' | 'weekly'
): Promise<Report[]> => {
    const res = await PrivateAxios.get('/reports', {
        params: { project_id: projectId, ...(type ? { type } : {}) },
    });
    return res.data.reports || [];
};
