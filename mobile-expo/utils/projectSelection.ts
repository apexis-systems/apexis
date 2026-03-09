export let globalActiveProject: string | null = null;
export let globalActiveFolder: string | null = null;

export const setActiveProjectContext = (projectId: string | null, folderId: string | null = null) => {
    globalActiveProject = projectId;
    globalActiveFolder = folderId;
};

export const getActiveProjectContext = () => {
    return {
        projectId: globalActiveProject,
        folderId: globalActiveFolder
    };
};
