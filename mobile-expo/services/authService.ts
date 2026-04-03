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

export const verifyInvitation = async (token: string) => {
    try {
        const response = await PublicAxios.get(`/auth/verify-invitation?token=${token}`);
        return response.data;
    } catch (error: any) {
        console.error("verifyInvitation Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const completeOnboarding = async (data: { token: string, name: string, password?: string }) => {
    try {
        const response = await PublicAxios.post('/auth/complete-onboarding', data);
        return response.data;
    } catch (error: any) {
        console.error("completeOnboarding Error:", error?.response?.data || error.message);
        throw error;
    }
};

// Public Onboarding
export const verifyOnboardingToken = async (token: string) => {
    try {
        const response = await PublicAxios.get(`/auth/verify-onboarding-token?token=${token}`);
        return response.data;
    } catch (error: any) {
        console.error("verifyOnboardingToken Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const completePublicSignup = async (data: any) => {
    try {
        const response = await PublicAxios.post('/auth/complete-public-signup', data);
        return response.data;
    } catch (error: any) {
        console.error("completePublicSignup Error:", error?.response?.data || error.message);
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

// ==========================
// WEB QR AUTHENTICATION
// ==========================

export const authorizeWebSession = async (sessionId: string) => {
    try {
        const response = await PrivateAxios.post('/qr/authorize', { sessionId });
        return response.data;
    } catch (error: any) {
        console.error("authorizeWebSession Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const getActiveWebSessions = async () => {
    try {
        const response = await PrivateAxios.get('/qr/sessions');
        return response.data; // { sessions: [] }
    } catch (error: any) {
        console.error("getActiveWebSessions Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const revokeWebSession = async (sessionId: string) => {
    try {
        const response = await PrivateAxios.delete(`/qr/sessions/${sessionId}`);
        return response.data;
    } catch (error: any) {
        console.error("revokeWebSession Error:", error?.response?.data || error.message);
        throw error;
    }
};

// ==========================
// PASSWORD MANAGEMENT
// ==========================

export const forgotPasswordRequestOtp = async (email: string, role: 'admin' | 'superadmin') => {
    try {
        const response = await PublicAxios.post('/auth/forgot-password/request-otp', { email, role });
        return response.data;
    } catch (error: any) {
        console.error("forgotPasswordRequestOtp Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const forgotPasswordVerifyOtp = async (email: string, otp: string) => {
    try {
        const response = await PublicAxios.post('/auth/forgot-password/verify-otp', { email, otp });
        return response.data; // { resetToken, message }
    } catch (error: any) {
        console.error("forgotPasswordVerifyOtp Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const resetPassword = async (resetToken: string, newPassword: string) => {
    try {
        const response = await PublicAxios.post('/auth/forgot-password/reset', { resetToken, newPassword });
        return response.data;
    } catch (error: any) {
        console.error("resetPassword Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const changePassword = async (data: any) => {
    try {
        const response = await PrivateAxios.post('/auth/change-password', data);
        return response.data;
    } catch (error: any) {
        console.error("changePassword Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const getMyMemberships = async () => {
    try {
        const response = await PrivateAxios.get('/auth/memberships');
        return response.data;
    } catch (error: any) {
        console.error("getMyMemberships Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const switchContext = async (project_id: number, role: string) => {
    try {
        const response = await PrivateAxios.post('/auth/switch-context', { project_id, role });
        return response.data; // { token, user: { ... } }
    } catch (error: any) {
        console.error("switchContext Error:", error?.response?.data || error.message);
        throw error;
    }
};
