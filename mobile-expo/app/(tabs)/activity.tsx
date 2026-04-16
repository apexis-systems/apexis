import { View, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { getActivities } from '@/services/activityService';
import { getOrganizations } from '@/services/organizationService';
import { getOrgUsers } from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { ActivityItem } from '@/types';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'expo-router';
import { handleActivityNavigation } from '@/utils/activityNavigation';

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    upload: 'upload',
    upload_photo: 'camera',
    edit: 'edit-2',
    delete: 'trash-2',
    share: 'share-2',
};

const colorMap: Record<string, { bg: string; icon: string }> = {
    upload: { bg: 'rgba(249,115,22,0.15)', icon: '#f97415' },
    upload_photo: { bg: 'rgba(59,130,246,0.15)', icon: '#3b82f6' },
    edit: { bg: 'rgba(168,85,247,0.15)', icon: '#a855f7' },
    delete: { bg: 'rgba(239,68,68,0.15)', icon: '#ef4444' },
    share: { bg: 'rgba(34,197,94,0.15)', icon: '#22c55e' },
};

const actionTypes = [
    { label: 'All Actions', value: 'all' },
    { label: 'Upload', value: 'upload' },
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete' },
    { label: 'Share', value: 'share' },
    { label: 'Photo Upload', value: 'upload_photo' },
];

export default function ActivityScreen() {
    const { user } = useAuth();
    const { colors: themeColors } = useTheme();
    const { t } = useTranslation();
    const { type } = useLocalSearchParams<{ type?: string }>();
    const { isTourActive } = require('@/contexts/TourContext').useTour();
    const { socket } = useSocket();
    const router = useRouter();

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [projectsList, setProjectsList] = useState<any[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    // Multi-select: empty array = "all"
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string | null>(type || null);

    const [activeModal, setActiveModal] = useState<'org' | 'user' | 'project' | 'type' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const u = await getOrgUsers();
                setUsersList(u || []);
                const p = await getProjects(selectedOrgId || undefined);
                setProjectsList(p.projects || []);
            } catch (e) {
                console.error('Filter fetch error', e);
            }
        };
        fetchFilters();
    }, [user, selectedOrgId]);

    useEffect(() => {
        const fetchFeed = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const filters: any = {
                    organization_id: selectedOrgId || undefined,
                    type: selectedType || undefined,
                };
                if (selectedProjectIds.length === 1) filters.project_id = selectedProjectIds[0];
                else if (selectedProjectIds.length > 1) filters.project_ids = selectedProjectIds.join(',');
                if (selectedUserIds.length === 1) filters.user_id = selectedUserIds[0];
                else if (selectedUserIds.length > 1) filters.user_ids = selectedUserIds.join(',');

                const data = await getActivities(filters);
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
    }, [user, selectedOrgId, selectedProjectIds, selectedUserIds, selectedType]);

    // Real-time updates
    useEffect(() => {
        if (!socket) return;
        const handleNewActivity = (newActivity: any) => {
            if (selectedOrgId && String(newActivity.organizationId) !== selectedOrgId) return;
            if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(String(newActivity.projectId))) return;
            if (selectedUserIds.length > 0 && !selectedUserIds.includes(String(newActivity.userId))) return;
            if (selectedType && newActivity.type !== selectedType) return;

            const formatted = {
                ...newActivity,
                timestamp: new Date(newActivity.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                })
            };
            setActivities(prev => {
                if (prev.some(a => a.id === formatted.id)) return prev;
                return [formatted, ...prev];
            });
        };
        socket.on('new-activity', handleNewActivity);
        return () => { socket.off('new-activity', handleNewActivity); };
    }, [socket, selectedOrgId, selectedProjectIds, selectedUserIds, selectedType]);

    const DUMMY_ACTIVITIES = [
        { id: 'da1', type: 'upload', description: 'uploaded new floor plans', userName: 'John Doe', projectName: 'Project Alpha', timestamp: 'Just now' },
        { id: 'da2', type: 'upload_photo', description: 'added 5 site photos', userName: 'Sarah Smith', projectName: 'Site B', timestamp: '2 mins ago' },
    ];

    const displayActivities = isTourActive ? DUMMY_ACTIVITIES : activities;

    if (!user) return null;

    // Toggle helpers for multi-select
    const toggleProject = (id: string) => {
        setSelectedProjectIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };
    const toggleUser = (id: string) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };

    // Label helpers
    const projectLabel = selectedProjectIds.length === 0
        ? 'All'
        : selectedProjectIds.length === 1
            ? (projectsList.find(p => String(p.id) === selectedProjectIds[0])?.name || '...')
            : `${selectedProjectIds.length} selected`;

    const userLabel = selectedUserIds.length === 0
        ? 'All'
        : selectedUserIds.length === 1
            ? (usersList.find(u => String(u.id) === selectedUserIds[0])?.name || '...')
            : `${selectedUserIds.length} selected`;

    const FilterButton = ({ label, value, onPress, title }: { label: string; value: boolean; onPress: () => void; title: string }) => (
        <TouchableOpacity
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: value ? 'rgba(249,115,22,0.1)' : themeColors.surface,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: value ? '#f97316' : themeColors.border,
                marginRight: 6
            }}
        >
            <Text style={{ fontSize: 10, fontWeight: '600', color: value ? '#f97316' : themeColors.text }}>
                {label}: {title}
            </Text>
            <Feather name="chevron-down" size={10} color={value ? '#f97316' : themeColors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: themeColors.surface, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>{t('Activity') || 'Activity'}</Text>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
                {/* Filters */}
                <View style={{ marginBottom: 14 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {user.role === 'superadmin' && (
                            <FilterButton
                                label="Org"
                                value={!!selectedOrgId}
                                title={selectedOrgId ? organizations.find(o => String(o.id) === selectedOrgId)?.name || '...' : 'All'}
                                onPress={() => setActiveModal('org')}
                            />
                        )}
                        <FilterButton
                            label="Project"
                            value={selectedProjectIds.length > 0}
                            title={projectLabel}
                            onPress={() => setActiveModal('project')}
                        />
                        <FilterButton
                            label="User"
                            value={selectedUserIds.length > 0}
                            title={userLabel}
                            onPress={() => setActiveModal('user')}
                        />
                        <FilterButton
                            label="Action"
                            value={!!selectedType}
                            title={selectedType ? actionTypes.find(a => a.value === selectedType)?.label || '...' : 'All'}
                            onPress={() => setActiveModal('type')}
                        />
                    </ScrollView>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={{ marginTop: 40, alignItems: 'center' }}>
                            <Text style={{ fontSize: 13, color: themeColors.textMuted }}>Loading activities...</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {(displayActivities as any[]).map((activity) => {
                                const iconName = iconMap[activity.type] || 'clock';
                                const colors = colorMap[activity.type] || { bg: 'rgba(100,100,100,0.15)', icon: '#666' };
                                return (
                                    <TouchableOpacity
                                        key={activity.id}
                                        onPress={() => handleActivityNavigation(activity, router)}
                                        activeOpacity={0.7}
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
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name={iconName} size={16} color={colors.icon} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.text }}>
                                                {activity.description}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }}>
                                                <Text style={{ fontWeight: '700', color: themeColors.text }}>{activity.userName}</Text>
                                                {activity.organizationName ? ` • ${activity.organizationName}` : ''}
                                                {activity.projectName ? ` (${activity.projectName})` : ''}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                <Feather name="clock" size={10} color={themeColors.textMuted} />
                                                <Text style={{ fontSize: 10, color: themeColors.textMuted }}>{activity.timestamp}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
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

            {/* Filter Modal */}
            <Modal visible={activeModal !== null} animationType="fade" transparent>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setActiveModal(null)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                    <View style={{
                        position: 'absolute',
                        top: 130,
                        left: 14,
                        right: 14,
                        backgroundColor: themeColors.surface,
                        borderRadius: 12,
                        padding: 4,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        borderWidth: 1,
                        borderColor: themeColors.border,
                    }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: themeColors.text }}>
                                Select {activeModal === 'org' ? 'Organization' : activeModal === 'user' ? 'User' : activeModal === 'project' ? 'Project' : 'Action'}
                            </Text>
                        </View>
                        <ScrollView style={{ maxHeight: 380 }}>
                            {/* "All" option */}
                            {activeModal !== 'type' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (activeModal === 'org') { setSelectedOrgId(null); setSelectedProjectIds([]); setSelectedUserIds([]); }
                                        else if (activeModal === 'project') setSelectedProjectIds([]);
                                        else if (activeModal === 'user') setSelectedUserIds([]);
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                >
                                    <View style={{
                                        width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                        borderColor: (activeModal === 'project' ? selectedProjectIds.length === 0 : activeModal === 'user' ? selectedUserIds.length === 0 : !selectedOrgId) ? '#f97316' : themeColors.border,
                                        backgroundColor: (activeModal === 'project' ? selectedProjectIds.length === 0 : activeModal === 'user' ? selectedUserIds.length === 0 : !selectedOrgId) ? '#f97316' : 'transparent',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {(activeModal === 'project' ? selectedProjectIds.length === 0 : activeModal === 'user' ? selectedUserIds.length === 0 : !selectedOrgId) && (
                                            <Feather name="check" size={11} color="#fff" />
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 14, color: themeColors.text }}>
                                        All {activeModal === 'org' ? 'Organizations' : activeModal === 'user' ? 'Users' : 'Projects'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Org (single-select) */}
                            {activeModal === 'org' && organizations.map((org) => {
                                const isSelected = selectedOrgId === String(org.id);
                                return (
                                    <TouchableOpacity
                                        key={org.id}
                                        onPress={() => { setSelectedOrgId(String(org.id)); setSelectedProjectIds([]); setSelectedUserIds([]); }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                            borderColor: isSelected ? '#f97316' : themeColors.border,
                                            backgroundColor: isSelected ? '#f97316' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: themeColors.text }}>{org.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {/* Project (multi-select) */}
                            {activeModal === 'project' && projectsList.map((p) => {
                                const isSelected = selectedProjectIds.includes(String(p.id));
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => toggleProject(String(p.id))}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                            borderColor: isSelected ? '#f97316' : themeColors.border,
                                            backgroundColor: isSelected ? '#f97316' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: themeColors.text }}>{p.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {/* User (multi-select) */}
                            {activeModal === 'user' && usersList.map((u) => {
                                const isSelected = selectedUserIds.includes(String(u.id));
                                return (
                                    <TouchableOpacity
                                        key={u.id}
                                        onPress={() => toggleUser(String(u.id))}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                            borderColor: isSelected ? '#f97316' : themeColors.border,
                                            backgroundColor: isSelected ? '#f97316' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: themeColors.text }}>{u.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {/* Type (single-select) */}
                            {activeModal === 'type' && actionTypes.map((a) => {
                                const isSelected = (selectedType || 'all') === a.value;
                                return (
                                    <TouchableOpacity
                                        key={a.value}
                                        onPress={() => { setSelectedType(a.value === 'all' ? null : a.value); setActiveModal(null); }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
                                            borderColor: isSelected ? '#f97316' : themeColors.border,
                                            backgroundColor: isSelected ? '#f97316' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: themeColors.text }}>{a.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Done button for multi-select modals */}
                        {(activeModal === 'project' || activeModal === 'user') && (
                            <TouchableOpacity
                                onPress={() => setActiveModal(null)}
                                style={{
                                    margin: 10,
                                    backgroundColor: '#f97316',
                                    borderRadius: 8,
                                    paddingVertical: 10,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Done</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
