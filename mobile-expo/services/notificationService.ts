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
        const token = await messaging().getToken();
        console.log('FCM Token (Native):', token);

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                lockscreenVisibility: Notifications.AndroidLockscreenVisibility.PUBLIC,
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
