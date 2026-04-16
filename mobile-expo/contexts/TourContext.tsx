import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


interface SpotlightPosition {
    x: number;
    y: number;
    r: number;
    w?: number;
    h?: number;
}

interface TourContextType {
    isTourActive: boolean;
    currentStep: number;
    startTour: () => void;
    stopTour: () => Promise<void>;
    nextStep: () => void;
    prevStep: () => void;
    hasSeenTour: boolean;
    setHasSeenTour: (value: boolean) => void;
    spotlights: Record<string, SpotlightPosition>;
    registerSpotlight: (id: string, pos: SpotlightPosition) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isTourActive, setIsTourActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasSeenTour, setHasSeenTourState] = useState(false);
    const [spotlights, setSpotlights] = useState<Record<string, SpotlightPosition>>({});

    const startTour = useCallback(() => {
        setIsTourActive(true);
        setCurrentStep(1);
    }, []);

    const stopTour = useCallback(async () => {
        setIsTourActive(false);
        setCurrentStep(0);
        await AsyncStorage.setItem('hasSeenTour', 'true');
        setHasSeenTourState(true);
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStep(prev => prev + 1);
    }, []);

    const prevStep = useCallback(() => {
        setCurrentStep(prev => Math.max(1, prev - 1));
    }, []);

    const setHasSeenTour = useCallback(async (value: boolean) => {
        await AsyncStorage.setItem('hasSeenTour', value ? 'true' : 'false');
        setHasSeenTourState(value);
    }, []);

    const registerSpotlight = useCallback((id: string, pos: SpotlightPosition) => {
        setSpotlights(prev => ({ ...prev, [id]: pos }));
    }, []);
    
    // Initial check
    React.useEffect(() => {
        const check = async () => {
            const val = await AsyncStorage.getItem('hasSeenTour');
            setHasSeenTourState(val === 'true');
        };
        check();
    }, []);

    return (
        <TourContext.Provider value={{
            isTourActive,
            currentStep,
            startTour,
            stopTour,
            nextStep,
            prevStep,
            hasSeenTour,
            setHasSeenTour,
            spotlights,
            registerSpotlight
        }}>
            {children}
        </TourContext.Provider>
    );
};

export const useTour = () => {
    const context = useContext(TourContext);
    if (!context) throw new Error('useTour must be used within a TourProvider');
    return context;
};
