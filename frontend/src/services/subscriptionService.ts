import { PrivateAxios } from '@/helpers/PrivateAxios';

/**
 * Service for Razorpay subscription and payments
 */

export const createOrder = async (data: { 
  amount: number; 
  currency: string; 
  plan_name: string; 
  plan_cycle: 'monthly' | 'annual';
  seats?: number;
}) => {
  try {
    const response = await PrivateAxios.post('/subscription/create-order', data);
    return response.data;
  } catch (error) {
    console.error("createOrder Error", error);
    throw error;
  }
};

export const verifyPayment = async (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan_name: string;
  plan_cycle: 'monthly' | 'annual';
}) => {
  try {
    const response = await PrivateAxios.post('/subscription/verify-payment', data);
    return response.data;
  } catch (error) {
    console.error("verifyPayment Error", error);
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

export const getUsage = async () => {
  try {
    const response = await PrivateAxios.get('/subscription/usage');
    return response.data;
  } catch (error) {
    console.error("getUsage Error", error);
    throw error;
  }
};

export const downloadInvoice = async (id: number, fileName?: string) => {
  try {
    const response = await PrivateAxios.get(`/subscription/invoice/${id}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || `Invoice_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("downloadInvoice Error", error);
    throw error;
  }
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
