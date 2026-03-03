import { PrivateAxios } from '@/helpers/PrivateAxios';

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
    summary: {
        by_folder: { name: string; photos: number; docs: number }[];
        by_user: { name: string; uploads: number }[];
        released_files: string[];
    } | null;
    createdAt: string;
}

export const getReports = async (projectId: string | number, type?: 'daily' | 'weekly'): Promise<Report[]> => {
    const res = await PrivateAxios.get('/reports', { params: { project_id: projectId, type } });
    return res.data.reports;
};

export const getReportById = async (id: string | number): Promise<Report> => {
    const res = await PrivateAxios.get(`/reports/${id}`);
    return res.data.report;
};

export const triggerReport = async (projectId: string | number, type: 'daily' | 'weekly' = 'daily') => {
    const res = await PrivateAxios.get('/reports/generate-now', { params: { project_id: projectId, type } });
    return res.data;
};
