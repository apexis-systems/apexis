"use client";

import React, { createContext, useContext, useState } from 'react';

type InterfaceMode = 'mobile' | 'desktop' | null;

interface InterfaceContextType {
    mode: InterfaceMode;
    setMode: (mode: InterfaceMode) => void;
}

const InterfaceContext = createContext<InterfaceContextType>({
    mode: null,
    setMode: () => { },
});

export const useInterface = () => useContext(InterfaceContext);

export const InterfaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<InterfaceMode>(null);

    return (
        <InterfaceContext.Provider value={{ mode, setMode }}>
            {children}
        </InterfaceContext.Provider>
    );
};
