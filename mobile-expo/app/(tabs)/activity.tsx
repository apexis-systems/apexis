import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getActivities } from '@/services/activityService';
import { getOrganizations } from '@/services/organizationService';
import { ActivityItem } from '@/types';

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    upload: 'upload',
    upload_photo: 'camera',
    edit: 'edit-2',
    delete: 'trash-2',
    share: 'share-2',
};

const colorMap: Record<string, { bg: string; icon: string }> = {
    upload: { bg: 'rgba(249,115,22,0.15)', icon: '#f97316' },
    upload_photo: { bg: 'rgba(59,130,246,0.15)', icon: '#3b82f6' },
    edit: { bg: 'rgba(168,85,247,0.15)', icon: '#a855f7' },
    delete: { bg: 'rgba(239,68,68,0.15)', icon: '#ef4444' },
    share: { bg: 'rgba(34,197,94,0.15)', icon: '#22c55e' },
};

export default function ActivityScreen() {
    const { user } = useAuth();
    const { colors: themeColors } = useTheme();
    const { t } = useTranslation();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        const fetchFeed = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const data = await getActivities(selectedOrgId || undefined);

                const formatted = data.map((act: any) => ({
                    ...act,
                    timestamp: new Date(act.timestamp).toLocaleString('en-IN', {
                        dateStyle: 'medium', timeStyle: 'short'
                    })
                }));

                setActivities(formatted);
            } catch (error) {
                console.error('Failed to load activity', error);
            } finally {
                setLoading(false);
            }
        };
        fetchFeed();
    }, [user, selectedOrgId]);

    if (!user) return null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
            <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: themeColors.text }}>{t('activity') || 'Recent Activity'}</Text>
                        <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }}>Updates from your projects</Text>
                    </View>
                    {user.role === 'superadmin' && organizations.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setIsOrgDropdownOpen(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: themeColors.surface,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: themeColors.border,
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: '600', color: themeColors.text }}>
                                {selectedOrgId ? organizations.find(o => o.id === selectedOrgId)?.name : 'All Orgs'}
                            </Text>
                            <Feather name="chevron-down" size={12} color={themeColors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={{ marginTop: 40, alignItems: 'center' }}>
                            <Text style={{ fontSize: 13, color: themeColors.textMuted }}>Loading activities...</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {activities.map((activity) => {
                                const iconName = iconMap[activity.type] || 'clock';
                                const colors = colorMap[activity.type] || { bg: 'rgba(100,100,100,0.15)', icon: '#666' };
                                return (
                                    <View
                                        key={activity.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'flex-start',
                                            gap: 12,
                                            borderRadius: 12,
                                            backgroundColor: themeColors.surface,
                                            borderWidth: 1,
                                            borderColor: themeColors.border,
                                            padding: 12,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 10,
                                                backgroundColor: colors.bg,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Feather name={iconName} size={16} color={colors.icon} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.text }}>
                                                {activity.description}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }}>
                                                <Text style={{ fontWeight: '700', color: themeColors.text }}>{activity.userName}</Text>
                                                {activity.projectName ? ` • ${activity.projectName}` : ''}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                <Feather name="clock" size={10} color={themeColors.textMuted} />
                                                <Text style={{ fontSize: 10, color: themeColors.textMuted }}>{activity.timestamp}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {!loading && activities.length === 0 && (
                        <View style={{ marginTop: 40, alignItems: 'center' }}>
                            <Feather name="clock" size={32} color={themeColors.border} />
                            <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 8 }}>No recent activity</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Org Selection Modal for Superadmin */}
            <Modal visible={isOrgDropdownOpen} animationType="fade" transparent>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsOrgDropdownOpen(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                >
                    <View style={{ backgroundColor: themeColors.surface, borderRadius: 20, width: '100%', maxWidth: 400, padding: 10, overflow: 'hidden' }}>
                        <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.text }}>Select Organization</Text>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            <TouchableOpacity
                                onPress={() => { setSelectedOrgId(null); setIsOrgDropdownOpen(false); }}
                                style={{ padding: 15, backgroundColor: selectedOrgId === null ? themeColors.background : 'transparent' }}
                            >
                                <Text style={{ fontSize: 14, color: themeColors.text, fontWeight: selectedOrgId === null ? 'bold' : 'normal' }}>All Organizations</Text>
                            </TouchableOpacity>
                            {organizations.map((org) => (
                                <TouchableOpacity
                                    key={org.id}
                                    onPress={() => { setSelectedOrgId(String(org.id)); setIsOrgDropdownOpen(false); }}
                                    style={{ padding: 15, backgroundColor: selectedOrgId === String(org.id) ? themeColors.background : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, color: themeColors.text, fontWeight: selectedOrgId === String(org.id) ? 'bold' : 'normal' }}>{org.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
