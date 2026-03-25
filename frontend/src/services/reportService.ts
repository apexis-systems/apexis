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
    summary?: {
        document_titles: string[];
        photo_summary: { count: number; user: string; folder: string }[];
        rfis: { title: string; status: string }[];
        snags: { title: string; status: string }[];
        photo_details?: { name: string; folder: string; uploaded_by: string }[];
        released_files?: string[];
    };
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

export const triggerReport = async (projectId: string | number, type: 'daily' | 'weekly' = 'daily') => {
    const res = await PrivateAxios.get('/reports/generate-now', {
        params: { project_id: projectId, type },
    });
    return res.data;
};
