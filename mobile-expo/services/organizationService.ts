import { PrivateAxios } from '../helpers/PrivateAxios';

export const uploadOrganizationLogo = async (formData: FormData) => {
    try {
        const response = await PrivateAxios.post('/organizations/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error("uploadOrganizationLogo Error", error);
        throw error;
    }
};

export const fetchSecureLogo = async (fileKey: string) => {
    try {
        const response = await PrivateAxios.post('/files/view', { fileKey }, {
            responseType: 'arraybuffer'
        });

        // Convert arraybuffer to base64 for React Native Image component
        const base64 = btoa(
            new Uint8Array(response.data).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                '',
            ),
        );

        const contentType = response.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error("fetchSecureLogo Error", error);
        return null;
    }
};
export const getOrganizations = async () => {
    try {
        const response = await PrivateAxios.get('/superadmin/organizations');
        return response.data.organizations;
    } catch (error) {
        console.error("getOrganizations Error", error);
        throw error;
    }
};
export const updateOrganization = async (data: { name: string }) => {
    try {
        const response = await PrivateAxios.patch('/organizations', data);
        return response.data;
    } catch (error) {
        console.error("updateOrganization Error", error);
        throw error;
    }
};
