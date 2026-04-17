import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PrivateAxios } from '../helpers/PrivateAxios';

export const registerForPushNotificationsAsync = async () => {
    let Notifications: any;
    let messaging: any;

    try {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        if (Constants.appOwnership === 'expo') {
            console.warn('Push Notifications (FCM/APNS) are not supported in Expo Go for SDK 53+. Please use a Development Build.');
            return null;
        }

        // Only require these when actually needed to avoid crashes in Expo Go
        try {
            Notifications = require('expo-notifications');
            messaging = require('@react-native-firebase/messaging').default;
        } catch (e) {
            console.log('Native notification modules not found.');
            return null;
        }


        if (!Notifications || !messaging) {
            console.log('Push notifications not supported in this environment (likely Expo Go).');
            return null;
        }

        // Set how notifications should be handled when the app is in the foreground
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
            }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            console.log('Requesting notification permissions...');
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            finalStatus = status;
        }

        console.log('Notification permission status:', finalStatus);

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification (permission not granted)!');
            return null;
        }

        // Register the device with FCM (required for iOS)
        if (!messaging().isDeviceRegisteredForRemoteMessages) {
            await messaging().registerDeviceForRemoteMessages();
        }

        // Use Firebase Native SDK to get the FCM token (works for both iOS and Android)
        console.log('Mobile - Fetching FCM token...');
        const token = await messaging().getToken();
        console.log('Mobile - FCM Token (Native):', token);

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default Channel',
                importance: 5, // Notifications.AndroidImportance.MAX
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                lockscreenVisibility: 1, // Notifications.AndroidLockscreenVisibility.PUBLIC
                showBadge: true,
            });
        }

        // Save token to backend
        console.log('Mobile - Sending token to backend...');
        const res = await PrivateAxios.patch('/users/push-token', { token });
        console.log('Mobile - Push token registration response:', res.status, res.data);

        return token;
    } catch (error: any) {
        console.error('Error registering for push notifications:', error?.message || error);
        return null;
    }
};

export const getNotifications = async (params: string[] = []) => {
    try {
        const url = params.length > 0 ? `/notifications?${params.join('&')}` : '/notifications';
        const response = await PrivateAxios.get(url);
        return response.data;
    } catch (error) {
        console.error("getNotifications Error", error);
        throw error;
    }
};

export const markAllNotificationsRead = async () => {
    try {
        const response = await PrivateAxios.patch('/notifications/read-all');
        return response.data;
    } catch (error) {
        console.error("markAllNotificationsRead Error", error);
        throw error;
    }
};

export const markNotificationRead = async (id: string | number) => {
    try {
        const response = await PrivateAxios.patch(`/notifications/${id}/read`);
        return response.data;
    } catch (error) {
        console.error("markNotificationRead Error", error);
        throw error;
    }
};
