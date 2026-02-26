import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, ManualSOP } from '@/types';
import { mockManuals } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    project: Project;
}

export default function ProjectManuals({ project }: Props) {
    const { user } = useAuth();
    const [manuals, setManuals] = useState<ManualSOP[]>(
        mockManuals.filter((m) => m.projectId === project.id)
    );

    const deleteManual = (id: string) => {
        Alert.alert('Delete', 'Remove this manual?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => setManuals((prev) => prev.filter((m) => m.id !== id)) },
        ]);
    };

    return (
        <View>
            {user?.role === 'admin' && (
                <TouchableOpacity
                    onPress={() => Alert.alert('Info', 'Upload manual/SOP functionality')}
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
                    <Feather name="upload" size={13} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload Manual / SOP</Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 6 }}>
                {manuals.map((m) => (
                    <View
                        key={m.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 10,
                            backgroundColor: '#111111',
                            borderWidth: 1,
                            borderColor: '#2a2a2a',
                            padding: 10,
                        }}
                    >
                        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="book-open" size={16} color="#f97316" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>{m.name}</Text>
                            <Text style={{ fontSize: 9, color: '#666' }}>{m.size} · {m.uploadDate}</Text>
                        </View>
                        {user?.role === 'admin' && (
                            <TouchableOpacity onPress={() => deleteManual(m.id)} style={{ padding: 4 }}>
                                <Feather name="trash-2" size={15} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>

            {manuals.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="book-open" size={32} color="#2a2a2a" />
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No manuals or SOPs yet</Text>
                </View>
            )}
        </View>
    );
}
