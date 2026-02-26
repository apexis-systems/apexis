import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, SnagItem, SnagStatus } from '@/types';
import { mockSnags, mockAllUsers } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    project: Project;
}

type StatusConfig = { icon: keyof typeof Feather.glyphMap; bg: string; iconColor: string; label: string };

const statusConfig: Record<SnagStatus, StatusConfig> = {
    red: { icon: 'x', bg: '#ef4444', iconColor: '#fff', label: 'No action needed' },
    amber: { icon: 'minus', bg: '#f59e0b', iconColor: '#fff', label: 'Waiting clearance' },
    green: { icon: 'check', bg: '#22c55e', iconColor: '#fff', label: 'Completed' },
};

export default function ProjectSnagList({ project }: Props) {
    const { user } = useAuth();
    const [snags, setSnags] = useState<SnagItem[]>(
        mockSnags.filter((s) => s.projectId === project.id)
    );
    const [showAdd, setShowAdd] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignee, setNewAssignee] = useState('');

    const cycleStatus = (id: string) => {
        const order: SnagStatus[] = ['amber', 'green', 'red'];
        setSnags((prev) =>
            prev.map((s) => {
                if (s.id !== id) return s;
                const idx = order.indexOf(s.status);
                return { ...s, status: order[(idx + 1) % order.length] };
            })
        );
    };

    const addSnag = () => {
        if (!newTitle.trim() || !newAssignee) {
            Alert.alert('Error', 'Title and assignee are required');
            return;
        }
        const assignee = mockAllUsers.find((u) => u.id === newAssignee);
        const snag: SnagItem = {
            id: `s-${Date.now()}`,
            projectId: project.id,
            title: newTitle.trim(),
            description: newDescription.trim() || undefined,
            assignedTo: newAssignee,
            assignedToName: assignee?.name || 'Unknown',
            status: 'amber',
            comments: [],
            createdAt: new Date().toISOString().split('T')[0],
        };
        setSnags((prev) => [...prev, snag]);
        setNewTitle('');
        setNewDescription('');
        setNewAssignee('');
        setShowAdd(false);
    };

    const assignableUsers = mockAllUsers.filter((u) => u.role !== 'client');

    return (
        <View>
            {user?.role !== 'client' && (
                <TouchableOpacity
                    onPress={() => setShowAdd(true)}
                    style={{
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: '#f97316',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        marginBottom: 12,
                    }}
                >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Add Snag</Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 8 }}>
                {snags.map((snag) => {
                    const cfg = statusConfig[snag.status];
                    return (
                        <View
                            key={snag.id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                gap: 10,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#2a2a2a',
                                backgroundColor: '#111111',
                                padding: 12,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => cycleStatus(snag.id)}
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: cfg.bg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 2,
                                }}
                            >
                                <Feather name={cfg.icon} size={13} color={cfg.iconColor} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{snag.title}</Text>
                                {snag.description && (
                                    <Text numberOfLines={2} style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{snag.description}</Text>
                                )}
                                <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                                    Assigned: {snag.assignedToName} · {cfg.label}
                                </Text>
                                {snag.comments.length > 0 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                        <Feather name="message-square" size={10} color="#555" />
                                        <Text numberOfLines={1} style={{ fontSize: 9, color: '#555' }}>{snag.comments[snag.comments.length - 1]}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>

            {snags.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#888' }}>No snags yet</Text>
                </View>
            )}

            {/* Add Snag Modal */}
            <Modal visible={showAdd} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 14 }}>Add Snag</Text>
                        <TextInput
                            value={newTitle}
                            onChangeText={setNewTitle}
                            placeholder="Snag title"
                            placeholderTextColor="#555"
                            style={{ height: 40, borderRadius: 10, backgroundColor: '#2a2a2a', color: '#fff', paddingHorizontal: 12, fontSize: 13, marginBottom: 10 }}
                        />
                        <TextInput
                            value={newDescription}
                            onChangeText={setNewDescription}
                            placeholder="Description (optional)"
                            placeholderTextColor="#555"
                            multiline
                            style={{ height: 70, borderRadius: 10, backgroundColor: '#2a2a2a', color: '#fff', paddingHorizontal: 12, paddingTop: 10, fontSize: 13, marginBottom: 10 }}
                        />
                        <Text style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Assign to:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                {assignableUsers.map((u) => (
                                    <TouchableOpacity
                                        key={u.id}
                                        onPress={() => setNewAssignee(u.id)}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 10,
                                            borderWidth: 2,
                                            borderColor: newAssignee === u.id ? '#f97316' : '#2a2a2a',
                                            backgroundColor: newAssignee === u.id ? 'rgba(249,115,22,0.1)' : '#2a2a2a',
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, color: newAssignee === u.id ? '#f97316' : '#888' }}>{u.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowAdd(false)} style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: '#888' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={addSnag} style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
