import { PublicAxios, PrivateAxios } from "@/helpers/PrivateAxios";

// Types matching backend controllers
export interface SuperAdminRequestOtpBody {
    name: string;
    email: string;
    password?: string; // Sometimes needed depending on if it's first step
}

export interface AdminRequestOtpBody extends SuperAdminRequestOtpBody {
    organization_name: string;
}

export interface VerifyOtpBody {
    email: string;
    otp: string;
}

export interface LoginBody {
    email?: string;
    phone?: string;
    password?: string;
}

// ----------------------------------------------------
// SuperAdmin Services
// ----------------------------------------------------

export const requestSuperAdminOtp = async (data: SuperAdminRequestOtpBody) => {
    try {
        const response = await PublicAxios.post("/onboarding/superadmin/signup/request-otp", data);
        return response.data;
    } catch (error) {
        console.error("requestSuperAdminOtp Error", error);
        throw error;
    }
};

export const verifySuperAdminOtp = async (data: VerifyOtpBody) => {
    try {
        const response = await PublicAxios.post("/onboarding/superadmin/signup/verify-otp", data);
        return response.data; // Should return { token, message }
    } catch (error) {
        console.error("verifySuperAdminOtp Error", error);
        throw error;
    }
};

export const loginSuperAdmin = async (data: LoginBody) => {
    try {
        const response = await PublicAxios.post("/auth/superadmin/login", data);
        return response.data; // Should return { token }
    } catch (error) {
        console.error("loginSuperAdmin Error", error);
        throw error;
    }
};

// ----------------------------------------------------
// Admin Services
// ----------------------------------------------------

export const requestAdminOtp = async (data: AdminRequestOtpBody) => {
    try {
        const response = await PublicAxios.post("/onboarding/admin/signup/request-otp", data);
        return response.data;
    } catch (error) {
        console.error("requestAdminOtp Error", error);
        throw error;
    }
};

export const verifyAdminOtp = async (data: VerifyOtpBody) => {
    try {
        const response = await PublicAxios.post("/onboarding/admin/signup/verify-otp", data);
        return response.data; // Should return { token, message }
    } catch (error) {
        console.error("verifyAdminOtp Error", error);
        throw error;
    }
};

export const loginAdmin = async (data: LoginBody) => {
    try {
        const response = await PublicAxios.post("/auth/admin/login", data);
        return response.data; // Should return { token }
    } catch (error) {
        console.error("loginAdmin Error", error);
        throw error;
    }
};

// ----------------------------------------------------
// Project Services (Contributor/Client)
// ----------------------------------------------------

export interface ProjectLoginBody {
    email?: string; // used for contributors
    phone?: string; // used for contributors
    name?: string;  // used for clients
    code: string;
}

export const loginProject = async (data: ProjectLoginBody) => {
    try {
        const response = await PublicAxios.post("/auth/project/login", data);
        return response.data; // Should return { token, project_id, role }
    } catch (error) {
        console.error("loginProject Error", error);
        throw error;
    }
};

export const getMe = async () => {
    try {
        const response = await PrivateAxios.get("/auth/me");
        return response.data; // Should return { user: { id, name, email, role, ... } }
    } catch (error) {
        console.error("getMe Error", error);
        throw error;
    }
};

export const getQrSession = async () => {
    try {
        const response = await PublicAxios.get("/qr/generate");
        return response.data; // { sessionId: string }
    } catch (error) {
        console.error("getQrSession Error", error);
        throw error;
    }
};

export const verifyInvitation = async (token: string) => {
    try {
        const response = await PublicAxios.get(`/auth/verify-invitation?token=${token}`);
        return response.data; // { email }
    } catch (error) {
        console.error("verifyInvitation Error", error);
        throw error;
    }
};

export const completeSuperAdminOnboarding = async (data: { token: string; name: string; password: string }) => {
    try {
        const response = await PublicAxios.post("/auth/complete-onboarding", data);
        return response.data;
    } catch (error) {
        console.error("completeSuperAdminOnboarding Error", error);
        throw error;
    }
};

// ----------------------------------------------------
// Password Management
// ----------------------------------------------------

export const forgotPasswordRequestOtp = async (email: string, role: 'admin' | 'superadmin') => {
    try {
        const response = await PublicAxios.post("/auth/forgot-password/request-otp", { email, role });
        return response.data;
    } catch (error) {
        console.error("forgotPasswordRequestOtp Error", error);
        throw error;
    }
};

export const forgotPasswordVerifyOtp = async (email: string, otp: string) => {
    try {
        const response = await PublicAxios.post("/auth/forgot-password/verify-otp", { email, otp });
        return response.data; // { resetToken, message }
    } catch (error) {
        console.error("forgotPasswordVerifyOtp Error", error);
        throw error;
    }
};

export const resetPassword = async (resetToken: string, newPassword: string) => {
    try {
        const response = await PublicAxios.post("/auth/forgot-password/reset", { resetToken, newPassword });
        return response.data;
    } catch (error) {
        console.error("resetPassword Error", error);
        throw error;
    }
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    try {
        const response = await PrivateAxios.post("/auth/change-password", data);
        return response.data;
    } catch (error) {
        console.error("changePassword Error", error);
        throw error;
    }
};

export const getMyMemberships = async () => {
    try {
        const response = await PrivateAxios.get("/auth/memberships");
        return response.data;
    } catch (error) {
        console.error("getMyMemberships Error", error);
        throw error;
    }
};

export const switchContext = async (params: { role: string; project_id?: number | null; organization_id?: number | null }) => {
    try {
        const response = await PrivateAxios.post("/auth/switch-context", params);
        return response.data; // { token, user: { ... } }
    } catch (error) {
        console.error("switchContext Error", error);
        throw error;
    }
};
