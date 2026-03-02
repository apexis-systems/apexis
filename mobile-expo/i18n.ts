import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import te from './locales/te.json';

const ASYNC_STORAGE_LANG_KEY = '@app_language';

const resources = {
    en,
    hi,
    te,
};

// Initialize i18next
const initI18n = async () => {
    let savedLanguage = await AsyncStorage.getItem(ASYNC_STORAGE_LANG_KEY);

    if (!savedLanguage) {
        // Fall back to device language if available and supported, otherwise English.
        const deviceLang = Localization.getLocales()[0]?.languageCode || 'en';
        savedLanguage = Object.keys(resources).includes(deviceLang) ? deviceLang : 'en';
    }

    i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: savedLanguage,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false, // React already does escaping
            },
        });
};

initI18n();

export default i18n;
