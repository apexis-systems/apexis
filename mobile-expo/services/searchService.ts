import { PrivateAxios } from '../helpers/PrivateAxios';

export const globalSearch = async (query: string) => {
    try {
        const response = await PrivateAxios.get(`/search/global?q=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        console.error("globalSearch Error", error);
        throw error;
    }
};
