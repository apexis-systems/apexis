import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

const roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'client', label: 'Client' },
];

const roleBadgeColor: Record<UserRole, { bg: string; text: string }> = {
    admin: { bg: '#f97316', text: '#fff' },
    contributor: { bg: '#3b3b3b', text: '#fff' },
    client: { bg: '#1e1e1e', text: '#888' },
};

export default function ProfileScreen() {
    const { user, switchRole, logout } = useAuth();
    const router = useRouter();

    if (!user) return null;

    const badge = roleBadgeColor[user.role];
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Avatar + Info */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: '#2a2a2a',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <Feather name="user" size={38} color="#fff" />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{user.name}</Text>
                    <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{user.email}</Text>
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
                        backgroundColor: '#111111',
                        borderWidth: 1,
                        borderColor: '#2a2a2a',
                        padding: 16,
                        marginBottom: 16,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Feather name="edit-2" size={14} color="#888" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Switch Demo Role</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {roles.map((role) => (
                            <TouchableOpacity
                                key={role.value}
                                onPress={() => switchRole(role.value)}
                                style={{
                                    flex: 1,
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: user.role === role.value ? '#f97316' : '#2a2a2a',
                                    backgroundColor: user.role === role.value ? 'rgba(249,115,22,0.1)' : '#1a1a1a',
                                    padding: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: user.role === role.value ? '#f97316' : '#888',
                                    }}
                                >
                                    {role.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

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
