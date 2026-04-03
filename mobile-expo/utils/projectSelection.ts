export let globalActiveProject: string | null = null;
export let globalActiveFolder: string | null = null;
export let globalActiveType: 'photo' | 'document' | null = null;

export const setActiveProjectContext = (projectId: string | null, folderId: string | null = null, type: 'photo' | 'document' | null = null) => {
    globalActiveProject = projectId;
    globalActiveFolder = folderId;
    globalActiveType = type;
};

export const getActiveProjectContext = () => {
    return {
        projectId: globalActiveProject,
        folderId: globalActiveFolder,
        type: globalActiveType
    };
};

