import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getActivities } from '@/services/activityService';
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
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeed = async () => {
            if (!user) return;
            try {
                const data = await getActivities();

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
    }, [user]);

    if (!user) return null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
            <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
                {/* Header */}
                <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: themeColors.text }}>Recent Activity</Text>
                    <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }}>Updates from your projects</Text>
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
                                            gap: 10,
                                            borderRadius: 10,
                                            backgroundColor: themeColors.surface,
                                            borderWidth: 1,
                                            borderColor: themeColors.border,
                                            padding: 10,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                backgroundColor: colors.bg,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Feather name={iconName} size={15} color={colors.icon} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '500', color: themeColors.text }}>
                                                {activity.description}
                                            </Text>
                                            <Text style={{ fontSize: 10, color: themeColors.textMuted, marginTop: 2 }}>
                                                {activity.projectName}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                <Feather name="clock" size={9} color={themeColors.textMuted} />
                                                <Text style={{ fontSize: 9, color: themeColors.textMuted }}>{activity.timestamp}</Text>
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
        </SafeAreaView>
    );
}
