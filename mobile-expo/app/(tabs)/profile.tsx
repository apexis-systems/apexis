import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

const roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'client', label: 'Client' },
    { value: 'superadmin', label: 'Super Admin' },
];

const roleBadgeColor: Record<UserRole, { bg: string; text: string }> = {
    admin: { bg: '#f97316', text: '#fff' },
    contributor: { bg: '#3b3b3b', text: '#fff' },
    client: { bg: '#1e1e1e', text: '#888' },
    superadmin: { bg: '#ef4444', text: '#fff' },
};

export default function ProfileScreen() {
    const { user, switchRole, logout } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

    if (!user) return null;

    const badge = { ...roleBadgeColor[user.role] };
    if (user.role === 'client') {
        badge.bg = colors.surface;
        badge.text = colors.textMuted;
    }

    const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => {
                    logout();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Avatar + Info */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 12,
                            marginBottom: 12,
                        }}
                    >
                        <Feather name="user" size={38} color={colors.text} />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{user.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{user.email}</Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 10,
                            borderRadius: 20,
                            backgroundColor: badge.bg,
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                        }}
                    >
                        <Feather name="shield" size={11} color={badge.text} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: badge.text }}>{roleLabel}</Text>
                    </View>
                </View>

                {/* Role Switcher */}
                <View
                    style={{
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 16,
                        marginBottom: 16,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Feather name="edit-2" size={14} color={colors.textMuted} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Switch Demo Role</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {roles.map((role) => (
                            <TouchableOpacity
                                key={role.value}
                                onPress={() => switchRole(role.value)}
                                style={{
                                    width: '48%',
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: user.role === role.value ? colors.primary : colors.border,
                                    backgroundColor: user.role === role.value ? 'rgba(249,115,22,0.1)' : colors.background,
                                    padding: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: user.role === role.value ? colors.primary : colors.textMuted,
                                    }}
                                >
                                    {role.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Linked Devices */}
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/linked-devices')}
                    style={{
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 16,
                        marginBottom: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ backgroundColor: 'rgba(249,115,22,0.1)', padding: 8, borderRadius: 8 }}>
                            <Feather name="monitor" size={18} color="#f97316" />
                        </View>
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Linked Devices</Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Scan QR to log in on Web</Text>
                        </View>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Sign Out */}
                <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                        height: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.4)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                    }}
                >
                    <Feather name="log-out" size={16} color="#ef4444" />
                    <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: '500' }}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
