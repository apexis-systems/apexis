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
    background: '#09090b', // slate-950
    surface: '#18181b',    // slate-900
    text: '#fafafa',       // slate-50
    textMuted: '#a1a1aa',  // slate-400
    border: '#27272a',     // slate-800
    primary: '#f97415',    // orange-500
};

const lightColors = {
    background: '#f4f4f5', // slate-100
    surface: '#ffffff',    // white
    text: '#09090b',       // slate-950
    textMuted: '#71717a',  // slate-500
    border: '#e4e4e7',     // slate-200
    primary: '#f97415',    // orange-500
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
