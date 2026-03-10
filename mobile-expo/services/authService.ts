import { PublicAxios, PrivateAxios } from '../helpers/PrivateAxios';

// ==========================
// ONBOARDING (Signup)
// ==========================

// Admins
export const requestAdminOtp = async (data: any) => {
    try {
        const response = await PublicAxios.post('/onboarding/admin/signup/request-otp', data);
        return response.data;
    } catch (error: any) {
        console.error("requestAdminOtp Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const verifyAdminOtp = async (data: any) => {
    try {
        const response = await PublicAxios.post('/onboarding/admin/signup/verify-otp', data);
        return response.data;
    } catch (error: any) {
        console.error("verifyAdminOtp Error:", error?.response?.data || error.message);
        throw error;
    }
};

// ==========================
// AUTHENTICATION (Login)
// ==========================

export const loginAdmin = async (data: any) => {
    try {
        const response = await PublicAxios.post('/auth/admin/login', data);
        return response.data;
    } catch (error: any) {
        console.error("loginAdmin Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const loginSuperAdmin = async (data: any) => {
    try {
        const response = await PublicAxios.post('/auth/superadmin/login', data);
        return response.data;
    } catch (error: any) {
        console.error("loginSuperAdmin Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const loginProject = async (data: any) => {
    try {
        const response = await PublicAxios.post('/auth/project/login', data);
        return response.data;
    } catch (error: any) {
        console.error("loginProject Error:", error?.response?.data || error.message);
        throw error;
    }
};

// ==========================
// GET PROFILE
// ==========================

export const getMe = async () => {
    try {
        const response = await PrivateAxios.get('/auth/me');
        return response.data;
    } catch (error: any) {
        if (error?.response?.status !== 401) {
            console.error("getMe Error", error?.response?.data || error.message);
        }
        throw error;
    }
};
