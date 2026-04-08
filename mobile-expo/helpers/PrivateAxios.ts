import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002/api';

console.log(API_URL)

export const PublicAxios = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const PrivateAxios = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

PrivateAxios.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStore.getItemAsync('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error fetching token from SecureStore', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

PrivateAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const code = error?.response?.data?.code;
        if (code === 'SUBSCRIPTION_LOCKED') {
            try {
                await SecureStore.setItemAsync('subscriptionLocked', 'true');
            } catch (secureStoreError) {
                console.error('Failed to persist subscription lock state', secureStoreError);
            }
            DeviceEventEmitter.emit('subscription-locked');
        }
        return Promise.reject(error);
    }
);
