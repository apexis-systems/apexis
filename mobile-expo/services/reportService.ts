import { PrivateAxios } from '@/helpers/PrivateAxios';

export interface Report {
    id: number;
    project_id: number;
    type: 'daily' | 'weekly' | 'monthly';

    period_start: string;
    period_end: string;
    photos_count: number;
    docs_count: number;
    releases_count: number;
    comments_count: number;
    summary: {
        document_titles: string[];
        photo_summary: { count: number; user: string; folder: string }[];
        rfis: { title: string; status: string }[];
        snags: { title: string; status: string }[];
        photo_details?: { name: string; folder: string; uploaded_by: string }[];
        released_files?: string[];
    } | null;
    createdAt: string;
}

export const getReports = async (projectId: string | number, type?: 'daily' | 'weekly' | 'monthly'): Promise<Report[]> => {

    try {
        const res = await PrivateAxios.get('/reports', { params: { project_id: projectId, type } });
        return res.data.reports || [];
    } catch (error) {
        console.error("getReports Error", error);
        throw error;
    }
};

export const getReportById = async (id: string | number): Promise<Report> => {
    try {
        const res = await PrivateAxios.get(`/reports/${id}`);
        return res.data.report;
    } catch (error) {
        console.error("getReportById Error", error);
        throw error;
    }
};

export const triggerReport = async (projectId: string | number, type: 'daily' | 'weekly' | 'monthly' = 'daily') => {

    try {
        const res = await PrivateAxios.get('/reports/generate-now', { params: { project_id: projectId, type } });
        return res.data;
    } catch (error) {
        console.error("triggerReport Error", error);
        throw error;
    }
};

export const getReportShareUrl = async (id: number): Promise<string> => {
    try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002/api';
        return `${API_URL}/reports/${id}/share`;
    } catch (error) {
        console.error("getReportShareUrl Error", error);
        throw error;
    }
};




