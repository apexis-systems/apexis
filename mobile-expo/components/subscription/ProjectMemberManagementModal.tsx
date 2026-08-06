import React, { useState } from 'react';
import {
    Modal,
    View,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import * as subscriptionService from '@/services/subscriptionService';

interface ProjectMember {
    project_member_id: number;
    user_id: number;
    role: string;
    name: string;
    email: string;
    phone_number?: string;
    profile_pic?: string;
}

interface ProjectDetail {
    id: number;
    name: string;
    description?: string;
    teamMemberCount: number;
    clientCount: number;
    targetSeats: number;
    exceeded: boolean;
    exceededBy: number;
    members: ProjectMember[];
}

interface ProjectMemberManagementModalProps {
    visible: boolean;
    onClose: () => void;
    targetSeats: number;
    projects: ProjectDetail[];
    onRefreshValidation: () => Promise<any>;
    onProceed: () => void;
}

export const ProjectMemberManagementModal: React.FC<ProjectMemberManagementModalProps> = ({
    visible,
    onClose,
    targetSeats,
    projects,
    onRefreshValidation,
    onProceed,
}) => {
    const { colors } = useTheme();
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [refreshing, setRefreshing] = useState<boolean>(false);

    if (!visible) return null;

    // Calculate total contributor memberships across all projects in the organization
    const totalContributors = projects.reduce(
        (sum, p) => sum + p.members.filter((m) => m.role === 'contributor').length,
        0
    );
    const isFullyCompliant = totalContributors <= targetSeats;
    const exceededByTotal = Math.max(0, totalContributors - targetSeats);

    const handleDeleteMember = async (projectId: number, userId: number, memberName: string) => {
        Alert.alert(
            "Remove Contributor",
            `Are you sure you want to remove ${memberName} from this project?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        setDeletingUserId(userId);
                        try {
                            await subscriptionService.removeProjectMember(projectId, userId);
                            setRefreshing(true);
                            await onRefreshValidation();
                        } catch (error: any) {
                            const msg = error.response?.data?.error || "Failed to remove contributor";
                            Alert.alert("Error", msg);
                        } finally {
                            setDeletingUserId(null);
                            setRefreshing(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <View style={styles.headerTitleRow}>
                            <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                                <Feather name="shield" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Manage Contributors ({targetSeats} Seats)
                                </Text>
                                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                                    Reduce contributor seats across projects to fit your target limit of {targetSeats} seat(s)
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Status Alert Banner */}
                    <View style={styles.alertContainer}>
                        {isFullyCompliant ? (
                            <View style={[styles.banner, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
                                <Feather name="check-circle" size={18} color="#10B981" />
                                <Text style={[styles.bannerText, { color: '#10B981' }]}>
                                    Total organization contributors ({totalContributors}) satisfies target limit of {targetSeats} seat(s)!
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.banner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                                <Feather name="alert-triangle" size={18} color="#F59E0B" />
                                <Text style={[styles.bannerText, { color: '#D97706' }]}>
                                    Organization has {totalContributors} total contributor(s) across projects. Remove {exceededByTotal} contributor(s) below.
                                </Text>
                            </View>
                        )}
                    </View>

                    {refreshing && (
                        <View style={styles.refreshingIndicator}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.refreshText, { color: colors.primary }]}>Updating...</Text>
                        </View>
                    )}

                    {/* Scrollable Project Cards */}
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {projects.map((project) => {
                            const contributorMembers = project.members.filter((m) => m.role === 'contributor');
                            const contributorCount = contributorMembers.length;

                            return (
                                <View
                                    key={project.id}
                                    style={[
                                        styles.projectCard,
                                        {
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    {/* Card Header */}
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.projectName, { color: colors.text }]}>
                                                {project.name}
                                            </Text>
                                            {project.description ? (
                                                <Text style={[styles.projectDesc, { color: colors.textMuted }]} numberOfLines={1}>
                                                    {project.description}
                                                </Text>
                                            ) : null}
                                        </View>

                                        <View
                                            style={[
                                                styles.badge,
                                                { backgroundColor: colors.primary + '15' },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.badgeText,
                                                    { color: colors.primary },
                                                ]}
                                            >
                                                {contributorCount} {contributorCount === 1 ? 'Contributor' : 'Contributors'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Members List (Only Contributors) */}
                                    {contributorMembers.length === 0 ? (
                                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                            No contributors in this project.
                                        </Text>
                                    ) : (
                                        contributorMembers.map((member) => {
                                            const isDeleting = deletingUserId === member.user_id;

                                            return (
                                                <View
                                                    key={member.project_member_id}
                                                    style={[styles.memberRow, { borderTopColor: colors.border + '40' }]}
                                                >
                                                    <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                                                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                                                            {member.name.charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>

                                                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                        <Text style={[styles.memberName, { color: colors.text }]}>
                                                            {member.name}
                                                        </Text>
                                                        <View style={styles.memberSubRow}>
                                                            <Text style={[styles.memberRole, { color: colors.primary }]}>
                                                                CONTRIBUTOR
                                                            </Text>
                                                            <Text
                                                                style={[styles.memberContact, { color: colors.textMuted }]}
                                                                numberOfLines={1}
                                                            >
                                                                {member.email || member.phone_number || ''}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <TouchableOpacity
                                                        onPress={() => handleDeleteMember(project.id, member.user_id, member.name)}
                                                        disabled={isDeleting}
                                                        style={styles.deleteBtn}
                                                    >
                                                        {isDeleting ? (
                                                            <ActivityIndicator size="small" color="#EF4444" />
                                                        ) : (
                                                            <Feather name="trash-2" size={18} color="#EF4444" />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Footer Button */}
                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={onProceed}
                            disabled={!isFullyCompliant}
                            style={[
                                styles.proceedBtn,
                                { backgroundColor: isFullyCompliant ? colors.primary : colors.border },
                            ]}
                        >
                            <Text style={styles.proceedBtnText}>
                                {isFullyCompliant ? 'Proceed to Payment / Upgrade' : 'Remove Contributors to Enable Upgrade'}
                            </Text>
                            {isFullyCompliant && <Feather name="arrow-right" size={18} color="#FFFFFF" />}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        maxHeight: '88%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 16,
        paddingBottom: 24,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    modalSub: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    alertContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
    },
    bannerText: {
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    refreshingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingBottom: 6,
    },
    refreshText: {
        fontSize: 12,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
    projectCard: {
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    projectName: {
        fontSize: 15,
        fontWeight: '800',
    },
    projectDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    emptyText: {
        fontSize: 12,
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 13,
        fontWeight: '900',
    },
    memberName: {
        fontSize: 13,
        fontWeight: '700',
    },
    memberSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    memberRole: {
        fontSize: 9,
        fontWeight: '900',
    },
    memberContact: {
        fontSize: 11,
    },
    deleteBtn: {
        padding: 8,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 14,
        borderTopWidth: 1,
    },
    proceedBtn: {
        height: 50,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    proceedBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
});
