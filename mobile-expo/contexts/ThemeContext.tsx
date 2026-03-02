import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
    colors: {
        background: string;
        surface: string;
        text: string;
        textMuted: string;
        border: string;
        primary: string;
    }
}

const darkColors = {
    background: '#0d0d0d',
    surface: '#111111',
    text: '#ffffff',
    textMuted: '#888888',
    border: '#2a2a2a',
    primary: '#f97316',
};

const lightColors = {
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#1a1a1a',
    textMuted: '#666666',
    border: '#e5e7eb',
    primary: '#f97316',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

    // Optional: Sync with system theme changes
    useEffect(() => {
        setIsDark(systemColorScheme === 'dark');
    }, [systemColorScheme]);

    const toggleTheme = () => {
        setIsDark(prev => !prev);
    };

    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
