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
