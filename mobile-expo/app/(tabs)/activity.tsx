import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { mockActivities } from '@/data/mock';
import { useTheme } from '@/contexts/ThemeContext';

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    upload: 'upload',
    edit: 'edit-2',
    delete: 'trash-2',
    share: 'share-2',
};

const colorMap: Record<string, { bg: string; icon: string }> = {
    upload: { bg: 'rgba(249,115,22,0.15)', icon: '#f97316' },
    edit: { bg: 'rgba(59,130,246,0.15)', icon: '#3b82f6' },
    delete: { bg: 'rgba(239,68,68,0.15)', icon: '#ef4444' },
    share: { bg: 'rgba(34,197,94,0.15)', icon: '#22c55e' },
};

export default function ActivityScreen() {
    const { user } = useAuth();
    const { colors: themeColors } = useTheme();

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
                    <View style={{ gap: 8 }}>
                        {mockActivities.map((activity) => {
                            const iconName = iconMap[activity.type];
                            const colors = colorMap[activity.type];
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

                    {mockActivities.length === 0 && (
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
