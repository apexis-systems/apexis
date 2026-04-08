import { PrivateAxios } from '@/helpers/PrivateAxios';

/**
 * Service for Razorpay subscription and payments
 */

export const createOrder = async (data: { 
  amount: number; 
  currency: string; 
  plan_name: string; 
  plan_cycle: 'monthly' | 'annual' 
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
