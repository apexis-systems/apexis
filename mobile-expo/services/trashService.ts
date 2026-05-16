import { PrivateAxios } from '../helpers/PrivateAxios';

export const getTrashItems = async (organization_id?: string) => {
    try {
        let url = '/trash';
        if (organization_id) {
            url += `?organization_id=${encodeURIComponent(organization_id)}`;
        }
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error('getTrashItems Error', error);
        throw error;
    }
};

export const restoreTrashItem = async (type: string, id: string | number) => {
    try {
        const response = await PrivateAxios.post(`/trash/${type}/${id}/restore`);
        return response.data;
    } catch (error) {
        console.error('restoreTrashItem Error', error);
        throw error;
    }
};

export const deleteTrashItemPermanently = async (type: string, id: string | number) => {
    try {
        const response = await PrivateAxios.delete(`/trash/${type}/${id}`);
        return response.data;
    } catch (error) {
        console.error('deleteTrashItemPermanently Error', error);
        throw error;
    }
};
