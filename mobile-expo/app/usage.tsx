import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatFileSize } from '@/helpers/format';

const { width } = Dimensions.get('window');

export default function UsageScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { usageData, loading: usageLoading, refreshUsage } = useUsage();
    const insets = useSafeAreaInsets();

    if (usageLoading && !usageData) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!usageData) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text>Failed to load usage data.</Text>
                <TouchableOpacity onPress={refreshUsage} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { plan, usage } = usageData;

    const renderUsageItem = (label: string, current: number, limit: number, unit: string = '') => {
        const percent = Math.min(100, Math.round((current / limit) * 100));

        return (
            <View style={styles.usageItem} key={label}>
                <View style={styles.usageHeader}>
                    <Text style={[styles.usageLabel, { color: colors.text }]}>{label}</Text>
                    <Text style={[styles.usageValue, { color: colors.textMuted }]}>
                        {label === 'Cloud Storage' ? formatFileSize(current) : `${current}${unit}`} / {label === 'Cloud Storage' ? formatFileSize(limit) : `${limit}${unit}`}
                    </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View 
                        style={[
                            styles.progressBarFill, 
                            { 
                                width: `${percent}%`, 
                                backgroundColor: colors.primary 
                            }
                        ]} 
                    />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={[styles.customHeader, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Resource Usage</Text>
                <TouchableOpacity onPress={refreshUsage} style={styles.headerIconBtn}>
                    <Feather name="refresh-cw" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Current Plan Summary */}
                <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.planHeader}>
                        <View>
                            <Text style={[styles.planBadge, { color: colors.primary }]}>ACTIVE PLAN</Text>
                            <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                        </View>
                        <MaterialCommunityIcons name="chart-donut" size={40} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>
                        Your plan valid until {new Date(plan.endDate).toLocaleDateString()}
                    </Text>
                </View>

                {/* Main Usage Grid */}
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>CONSUMPTION BREAKDOWN</Text>
                <View style={[styles.usageGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {renderUsageItem('Projects', usage.projects, plan.limits.project_limit)}
                    {renderUsageItem('Cloud Storage', usage.storage_mb, plan.limits.storage_limit_mb, ' MB')}
                    {renderUsageItem('Contributors', usage.contributors, plan.limits.contributor_limit)}
                    {renderUsageItem('Clients', usage.clients, plan.limits.client_limit)}
                    {renderUsageItem('Snags Count', usage.snags, plan.limits.max_snags)}
                    {renderUsageItem('RFIs Count', usage.rfis, plan.limits.max_rfis)}
                </View>

                <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
                    <Feather name="info" size={16} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                        Limits reset upon plan renewal. Upgrade your plan to increase these quotas.
                    </Text>
                </View>

                {/* Call to action */}
                <TouchableOpacity 
                    onPress={() => router.push('/subscription')}
                    style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
                >
                    <Text style={styles.upgradeBtnText}>Manage Subscription</Text>
                    <Feather name="arrow-right" size={18} color="white" />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    planCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        marginBottom: 32,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    planBadge: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    planName: {
        fontSize: 24,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#888',
        marginBottom: 16,
        letterSpacing: 1,
        paddingHorizontal: 4,
    },
    usageGrid: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        gap: 24,
        marginBottom: 24,
    },
    usageItem: {
        width: '100%',
    },
    usageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    usageLabel: {
        fontSize: 14,
        fontWeight: '700',
    },
    usageValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    infoBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        marginBottom: 32,
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    upgradeBtn: {
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    upgradeBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
    }
});
