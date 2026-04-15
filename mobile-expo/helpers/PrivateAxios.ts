import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:5002/api' : '');

if (__DEV__) {
    console.log('[Dev] API_URL:', API_URL);
} else {
    console.log('[Prod] API_URL:', API_URL);
}

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
            let token = await SecureStore.getItemAsync('token');
            if (!token) {
                // Minor retry delay if token was just refreshed or set
                await new Promise(r => setTimeout(r, 250));
                token = await SecureStore.getItemAsync('token');
                
                // One more final attempt if still null, total wait 750ms
                if (!token) {
                    await new Promise(r => setTimeout(r, 500));
                    token = await SecureStore.getItemAsync('token');
                }
            }
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
