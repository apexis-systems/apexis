"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export type Language = 'en' | 'hi' | 'te';

const translations: Record<Language, Record<string, string>> = {
  en: {
    welcome_back: 'Welcome back',
    hi: 'Hi',
    dashboard: 'Dashboard',
    upload: 'Upload',
    activity: 'Activity',
    profile: 'Profile',
    snag_list: 'Snag List',
    user_mgmt: 'User Mgmt',
    billing: 'Billing',
    projects: 'Projects',
    documents: 'Documents',
    photos: 'Photos',
    sign_in: 'Sign In',
    sign_up: 'Sign Up',
    sign_out: 'Sign Out',
    settings: 'Settings',
    search: 'Search',
    notifications: 'Notifications',
    help_support: 'Help & Support',
    feedback: 'Feedback',
    your_projects: 'Your Projects',
    total_projects: 'Total Projects',
    manage_projects: 'Manage all your company projects',
    assigned_projects: 'View and contribute to your assigned projects',
    shared_projects: 'Access your shared project files',
    no_projects: 'No projects available',
    language: 'Language',
    english: 'English',
    hindi: 'Hindi',
    telugu: 'Telugu',
    choose_plan: 'Choose Plan',
    recommended: 'Recommended',
    standard: 'Standard',
    intermediate: 'Intermediate',
    pro: 'Pro',
    project_overview: 'Project Overview',
    back_to_projects: 'Back to Projects',
    daily_reports: 'Daily Reports',
    weekly_reports: 'Weekly Reports',
    manuals: 'Manuals & SOPs',
    project_not_found: 'Project not found.',
    back_to_dashboard: 'Back to Dashboard',
  },
  hi: {
    welcome_back: 'वापसी पर स्वागत है',
    hi: 'नमस्ते',
    dashboard: 'डैशबोर्ड',
    upload: 'अपलोड',
    activity: 'गतिविधि',
    profile: 'प्रोफ़ाइल',
    snag_list: 'स्नैग सूची',
    user_mgmt: 'उपयोगकर्ता प्रबंधन',
    billing: 'बिलिंग',
    projects: 'परियोजनाएं',
    documents: 'दस्तावेज़',
    photos: 'तस्वीरें',
    sign_in: 'साइन इन',
    sign_up: 'साइन अप',
    sign_out: 'साइन आउट',
    settings: 'सेटिंग्स',
    search: 'खोजें',
    notifications: 'सूचनाएं',
    help_support: 'सहायता और समर्थन',
    feedback: 'प्रतिक्रिया',
    your_projects: 'आपकी परियोजनाएं',
    total_projects: 'कुल परियोजनाएं',
    manage_projects: 'अपनी सभी कंपनी परियोजनाएं प्रबंधित करें',
    assigned_projects: 'अपनी सौंपी गई परियोजनाओं को देखें और योगदान दें',
    shared_projects: 'अपनी साझा परियोजना फ़ाइलें एक्सेस करें',
    no_projects: 'कोई परियोजना उपलब्ध नहीं',
    language: 'भाषा',
    english: 'अंग्रेज़ी',
    hindi: 'हिन्दी',
    telugu: 'తెలుగు',
    choose_plan: 'योजना चुनें',
    recommended: 'सुझाया गया',
    standard: 'स्टैंडर्ड',
    intermediate: 'इंटरमीडिएट',
    pro: 'प्रो',
    project_overview: 'परियोजना अवलोकन',
    back_to_projects: 'परियोजनाओं पर वापस जाएं',
    daily_reports: 'दैनिक रिपोर्ट',
    weekly_reports: 'साप्ताहिक रिपोर्ट',
    manuals: 'मैनुअल और SOP',
    project_not_found: 'परियोजना नहीं मिली।',
    back_to_dashboard: 'डैशबोर्ड पर वापस जाएं',
  },
  te: {
    welcome_back: 'తిరిగి స్వాగతం',
    hi: 'హాయ్',
    dashboard: 'డ్యాష్‌బోర్డ్',
    upload: 'అప్‌లోడ్',
    activity: 'కార్యాచరణ',
    profile: 'ప్రొఫైల్',
    snag_list: 'స్నాగ్ జాబితా',
    user_mgmt: 'వినియోగదారు నిర్వహణ',
    billing: 'బిల్లింగ్',
    projects: 'ప్రాజెక్ట్‌లు',
    documents: 'పత్రాలు',
    photos: 'ఫోటోలు',
    sign_in: 'సైన్ ఇన్',
    sign_up: 'సైన్ అప్',
    sign_out: 'సైన్ అవుట్',
    settings: 'సెట్టింగ్‌లు',
    search: 'వెతకండి',
    notifications: 'నోటిఫికేషన్లు',
    help_support: 'సహాయం & మద్దతు',
    feedback: 'అభిప్రాయం',
    your_projects: 'మీ ప్రాజెక్ట్‌లు',
    total_projects: 'మొత్తం ప్రాజెక్ట్‌లు',
    manage_projects: 'మీ అన్ని కంపెనీ ప్రాజెక్ట్‌లను నిర్వహించండి',
    assigned_projects: 'మీ కేటాయించిన ప్రాజెక్ట్‌లను చూడండి',
    shared_projects: 'మీ షేర్ చేసిన ప్రాజెక్ట్ ఫైల్‌లను యాక్సెస్ చేయండి',
    no_projects: 'ప్రాజెక్ట్‌లు అందుబాటులో లేవు',
    language: 'భాష',
    english: 'ఆంగ్లం',
    hindi: 'హిందీ',
    telugu: 'తెలుగు',
    choose_plan: 'ప్లాన్ ఎంచుకోండి',
    recommended: 'సిఫార్సు చేయబడింది',
    standard: 'స్టాండర్డ్',
    intermediate: 'ఇంటర్మీడియట్',
    pro: 'ప్రో',
    project_overview: 'ప్రాజెక్ట్ అవలోకనం',
    back_to_projects: 'ప్రాజెక్ట్‌లకు తిరిగి వెళ్ళు',
    daily_reports: 'రోజువారీ నివేదికలు',
    weekly_reports: 'వారపు నివేదికలు',
    manuals: 'మాన్యువల్స్ & SOPs',
    project_not_found: 'ప్రాజెక్ట్ కనుగొనబడలేదు.',
    back_to_dashboard: 'డ్యాష్‌బోర్డ్‌కు తిరిగి వెళ్ళు',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => { },
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('apexis-lang') as Language) || 'en';
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('apexis-lang', lang);
  }, []);

  const t = useCallback((key: string) => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
