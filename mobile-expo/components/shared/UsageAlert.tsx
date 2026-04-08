import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useUsage } from '@/contexts/UsageContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export const UsageAlert: React.FC = () => {
    const { usageData } = useUsage();
    const router = useRouter();

    if (!usageData || !usageData.alert) return null;

    const { alert } = usageData;
    const isError = alert.severity === 'error';

    return (
        <View style={[
            styles.container, 
            { backgroundColor: isError ? '#dc2626' : '#f97316' }
        ]}>
            <View style={styles.content}>
                <Feather 
                    name={isError ? "alert-triangle" : "info"} 
                    color="white" 
                    size={18} 
                />
                <Text style={styles.message}>
                    {alert.message}
                </Text>
            </View>
            
            <View style={styles.actions}>
                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => router.push('/(tabs)/settings')}
                >
                    <Text style={styles.buttonText}>Upgrade</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton}>
                    <Feather name="x" color="white" size={16} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    message: {
        color: 'white',
        fontSize: 12,
        flex: 1,
        fontFamily: 'Montserrat-Medium',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    button: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 10,
        fontFamily: 'Montserrat-Bold',
    },
    closeButton: {
        padding: 2,
    }
});
