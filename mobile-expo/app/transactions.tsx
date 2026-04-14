import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { getTransactions, getInvoiceDownloadUrl } from '@/services/subscriptionService';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

export default function TransactionsScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sharingId, setSharingId] = useState<number | null>(null);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const data = await getTransactions();
            setTransactions(data);
        } catch (error) {
            console.error("Failed to fetch transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleShareInvoice = async (item: any) => {
        setSharingId(item.id);
        try {
            const token = await SecureStore.getItemAsync('token');
            const url = getInvoiceDownloadUrl(item.id);
            const fileName = `Invoice_${item.invoice_number || item.id}.pdf`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            const { uri } = await FileSystem.downloadAsync(
                url,
                fileUri,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error("handleShareInvoice Error", error);
        } finally {
            setSharingId(null);
        }
    };

    const renderTransaction = ({ item }: { item: any }) => {
        const isSuccess = item.payment_status === 'success';
        
        return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.statusIndicator, { backgroundColor: isSuccess ? '#22c55e' : '#eab308' }]} />
                <View style={styles.cardContent}>
                    <View style={styles.header}>
                        <Text style={[styles.planName, { color: colors.text }]}>{item.subscription_tier}</Text>
                        <Text style={[styles.amount, { color: colors.text }]}>₹{item.payment_amount}</Text>
                    </View>
                    
                    <View style={styles.details}>
                        <View style={styles.detailRow}>
                            <Feather name="calendar" size={12} color={colors.textMuted} />
                            <Text style={[styles.detailText, { color: colors.textMuted }]}>
                                {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Feather name="repeat" size={12} color={colors.textMuted} />
                            <Text style={[styles.detailText, { color: colors.textMuted, textTransform: 'capitalize' }]}>
                                {item.subscription_cycle}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={styles.footer}>
                        <View>
                            <Text style={[styles.orderId, { color: colors.textMuted }]}>ID: {item.payment_order_id}</Text>
                            <Text style={[styles.orderId, { color: colors.textMuted, marginTop: 2 }]}>
                                Invoice: {item.invoice_number || '-'}
                            </Text>
                        </View>
                        <View style={styles.actionRow}>
                            {isSuccess && (
                                <TouchableOpacity
                                    onPress={() => handleShareInvoice(item)}
                                    disabled={sharingId === item.id}
                                    style={[styles.shareButton, { backgroundColor: colors.primary + '15' }]}
                                >
                                    {sharingId === item.id
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : <Feather name="share-2" size={14} color={colors.primary} />
                                    }
                                </TouchableOpacity>
                            )}
                            <View style={[styles.statusBadge, { backgroundColor: isSuccess ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)' }]}>
                                <Text style={[styles.statusText, { color: isSuccess ? '#22c55e' : '#eab308' }]}>
                                    {item.payment_status.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
            <Stack.Screen 
                options={{ 
                    title: 'Payment History',
                    headerShown: true,
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Feather name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )
                }} 
            />

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Feather name="info" size={48} color={colors.border} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 20,
        gap: 16,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    statusIndicator: {
        width: 6,
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    planName: {
        fontSize: 18,
        fontWeight: '800',
    },
    amount: {
        fontSize: 18,
        fontWeight: '900',
    },
    details: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 12,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 12,
    },
    orderId: {
        fontSize: 10,
        fontFamily: 'monospace',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    shareButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        paddingTop: 100,
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
    }
});
