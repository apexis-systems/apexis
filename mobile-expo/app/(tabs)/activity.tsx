import { View, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getActivities } from '@/services/activityService';
import { getOrganizations } from '@/services/organizationService';
import { getOrgUsers } from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { ActivityItem } from '@/types';

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

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [projectsList, setProjectsList] = useState<any[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const [activeModal, setActiveModal] = useState<'org' | 'user' | 'project' | 'type' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    // Fetch filters (users/projects)
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                // Users
                const u = await getOrgUsers();
                setUsersList(u || []);
                // Projects
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
                const filters = {
                    organization_id: selectedOrgId || undefined,
                    user_id: selectedUserId || undefined,
                    project_id: selectedProjectId || undefined,
                    type: selectedType || undefined,
                };
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
    }, [user, selectedOrgId, selectedUserId, selectedProjectId, selectedType]);

    if (!user) return null;

    const FilterButton = ({ label, value, onPress, title }: { label: string; value: string | null; onPress: () => void; title: string }) => (
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
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>{t('activity') || 'Activity'}</Text>
            </View>


            <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
                {/* Filters */}
                <View style={{ marginBottom: 14 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {user.role === 'superadmin' && (
                            <FilterButton
                                label="Org"
                                value={selectedOrgId}
                                title={selectedOrgId ? organizations.find(o => String(o.id) === selectedOrgId)?.name || '...' : 'All'}
                                onPress={() => setActiveModal('org')}
                            />
                        )}
                        <FilterButton
                            label="Project"
                            value={selectedProjectId}
                            title={selectedProjectId ? projectsList.find(p => String(p.id) === selectedProjectId)?.name || '...' : 'All'}
                            onPress={() => setActiveModal('project')}
                        />
                        <FilterButton
                            label="User"
                            value={selectedUserId}
                            title={selectedUserId ? usersList.find(u => String(u.id) === selectedUserId)?.name || '...' : 'All'}
                            onPress={() => setActiveModal('user')}
                        />
                        <FilterButton
                            label="Action"
                            value={selectedType}
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

            {/* Filter Modal (Dropdown Style) */}
            <Modal visible={activeModal !== null} animationType="fade" transparent>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setActiveModal(null)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' }}
                >
                    <View style={{
                        position: 'absolute',
                        top: 130, // Positioned below the filter row
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
                        <ScrollView style={{ maxHeight: 400 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (activeModal === 'org') { setSelectedOrgId(null); setSelectedUserId(null); setSelectedProjectId(null); }
                                    else if (activeModal === 'user') setSelectedUserId(null);
                                    else if (activeModal === 'project') setSelectedProjectId(null);
                                    else if (activeModal === 'type') setSelectedType(null);
                                    setActiveModal(null);
                                }}
                                style={{ padding: 15 }}
                            >
                                <Text style={{ fontSize: 14, color: themeColors.text }}>All {activeModal === 'org' ? 'Organizations' : activeModal === 'user' ? 'Users' : activeModal === 'project' ? 'Projects' : 'Actions'}</Text>
                            </TouchableOpacity>

                            {activeModal === 'org' && organizations.map((org) => (
                                <TouchableOpacity
                                    key={org.id}
                                    onPress={() => { setSelectedOrgId(String(org.id)); setSelectedUserId(null); setSelectedProjectId(null); setActiveModal(null); }}
                                    style={{ padding: 15, backgroundColor: selectedOrgId === String(org.id) ? themeColors.background : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, color: themeColors.text }}>{org.name}</Text>
                                </TouchableOpacity>
                            ))}

                            {activeModal === 'project' && projectsList.map((p) => (
                                <TouchableOpacity
                                    key={p.id}
                                    onPress={() => { setSelectedProjectId(String(p.id)); setActiveModal(null); }}
                                    style={{ padding: 15, backgroundColor: selectedProjectId === String(p.id) ? themeColors.background : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, color: themeColors.text }}>{p.name}</Text>
                                </TouchableOpacity>
                            ))}

                            {activeModal === 'user' && usersList.map((u) => (
                                <TouchableOpacity
                                    key={u.id}
                                    onPress={() => { setSelectedUserId(String(u.id)); setActiveModal(null); }}
                                    style={{ padding: 15, backgroundColor: selectedUserId === String(u.id) ? themeColors.background : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, color: themeColors.text }}>{u.name}</Text>
                                </TouchableOpacity>
                            ))}

                            {activeModal === 'type' && actionTypes.filter(a => a.value !== 'all').map((a) => (
                                <TouchableOpacity
                                    key={a.value}
                                    onPress={() => { setSelectedType(a.value); setActiveModal(null); }}
                                    style={{ padding: 15, backgroundColor: selectedType === a.value ? themeColors.background : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, color: themeColors.text }}>{a.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
