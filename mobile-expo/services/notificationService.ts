import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { Platform } from 'react-native';
import { PrivateAxios } from '../helpers/PrivateAxios';

export const registerForPushNotificationsAsync = async () => {
    try {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        if (Constants.appOwnership === 'expo') {
            console.warn('Push Notifications (FCM/APNS) are not supported in Expo Go for SDK 53+. Please use a Development Build.');
            return null;
        }


        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        const token = (await Notifications.getDevicePushTokenAsync()).data;
        console.log('FCM Token:', token);

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        // Save token to backend
        const res = await PrivateAxios.patch('/users/push-token', { token });
        console.log('Push token save response:', res.data);

        return token;
    } catch (error: any) {
        console.error('Error registering for push notifications:', error?.message || error);
        return null;
    }
};
