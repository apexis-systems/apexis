import { PrivateAxios } from '../helpers/PrivateAxios';

export const getUsage = async () => {
    try {
        const response = await PrivateAxios.get('/subscription/usage');
        return response.data;
    } catch (error) {
        console.error("getUsage Error", error);
        throw error;
    }
};

export const getPlans = async () => {
    try {
        const response = await PrivateAxios.get('/subscription/plans');
        return response.data;
    } catch (error) {
        console.error("getPlans Error", error);
        throw error;
    }
};

export const getTransactions = async () => {
    try {
        const response = await PrivateAxios.get('/subscription/transactions');
        return response.data;
    } catch (error) {
        console.error("getTransactions Error", error);
        throw error;
    }
};

export const createOrder = async (data: any) => {
    try {
        const response = await PrivateAxios.post('/subscription/create-order', data);
        return response.data;
    } catch (error) {
        console.error("createOrder Error", error);
        throw error;
    }
};

export const verifyPayment = async (data: any) => {
    try {
        const response = await PrivateAxios.post('/subscription/verify-payment', data);
        return response.data;
    } catch (error) {
        console.error("verifyPayment Error", error);
        throw error;
    }
};

export const cancelAutoPay = async () => {
    try {
        const response = await PrivateAxios.post('/subscription/cancel-autopay');
        return response.data;
    } catch (error) {
        console.error("cancelAutoPay Error", error);
        throw error;
    }
};

export const getInvoiceDownloadUrl = (id: number) => {
    return `${PrivateAxios.defaults.baseURL}/subscription/invoice/${id}`;
};

export const validateSeatChange = async (targetSeats: number) => {
    try {
        const response = await PrivateAxios.post('/subscription/validate-seat-change', { targetSeats });
        return response.data;
    } catch (error) {
        console.error("validateSeatChange Error", error);
        throw error;
    }
};

export const removeProjectMember = async (projectId: number, userId: number) => {
    try {
        const response = await PrivateAxios.delete(`/projects/${projectId}/members/${userId}`);
        return response.data;
    } catch (error) {
        console.error("removeProjectMember Error", error);
        throw error;
    }
};
