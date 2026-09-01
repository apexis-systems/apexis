import { PrivateAxios } from "@/helpers/PrivateAxios";

export interface ArchivedProject {
    id: number;
    organization_id: number;
    original_project_id: number;
    name: string;
    description?: string;
    contributor_code: string;
    client_code: string;
    start_date: string;
    end_date: string;
    archived_at: string;
    zip_file_url?: string;
    zip_file_size_bytes?: number;
    download_url?: string;
    status: 'archiving' | 'archived' | 'restoring' | 'failed';
    error_message?: string;
    stats_summary?: {
        total_files?: number;
        total_photos?: number;
        total_docs?: number;
        total_snags?: number;
        total_rfis?: number;
        total_comments?: number;
        total_members?: number;
        storage_mb?: number;
    };
    archiver?: {
        id: number;
        name: string;
        email: string;
        profile_pic?: string;
    };
}

export const archiveProject = async (projectId: string | number) => {
    try {
        const response = await PrivateAxios.post(`/archives/${projectId}/archive`);
        return response.data;
    } catch (error) {
        console.error("archiveProject Error", error);
        throw error;
    }
};

export const getArchivedProjects = async (): Promise<{ archives: ArchivedProject[]; total: number }> => {
    try {
        const response = await PrivateAxios.get('/archives');
        return response.data;
    } catch (error) {
        console.error("getArchivedProjects Error", error);
        throw error;
    }
};

export const getArchiveDownloadUrl = async (archiveId: number | string) => {
    try {
        const response = await PrivateAxios.get(`/archives/${archiveId}/download`);
        return response.data.downloadUrl;
    } catch (error) {
        console.error("getArchiveDownloadUrl Error", error);
        throw error;
    }
};

export const restoreProjectArchive = async (archiveId: number | string) => {
    try {
        const response = await PrivateAxios.post(`/archives/${archiveId}/restore`);
        return response.data;
    } catch (error) {
        console.error("restoreProjectArchive Error", error);
        throw error;
    }
};

export const deleteArchivedProject = async (archiveId: number | string) => {
    try {
        const response = await PrivateAxios.delete(`/archives/${archiveId}`);
        return response.data;
    } catch (error) {
        console.error("deleteArchivedProject Error", error);
        throw error;
    }
};
