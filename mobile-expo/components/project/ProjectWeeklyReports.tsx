import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { mockReports } from '@/data/mock';

interface Props {
    project: Project;
    userRole: UserRole;
}

export default function ProjectWeeklyReports({ project, userRole }: Props) {
    const weeklyReports = mockReports.filter(
        (r) => r.projectId === project.id && r.type === 'weekly'
    );

    return (
        <View>
            {userRole !== 'client' && (
                <TouchableOpacity
                    onPress={() => Alert.alert('Info', 'Upload weekly report functionality')}
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
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload Weekly Report</Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 6 }}>
                {weeklyReports.map((report) => (
                    <View
                        key={report.id}
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
                        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="file-text" size={16} color="#888" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>{report.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <Feather name="calendar" size={9} color="#555" />
                                <Text style={{ fontSize: 9, color: '#555' }}>{report.date} · {report.uploader}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {weeklyReports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="file-text" size={32} color="#2a2a2a" />
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No weekly reports yet</Text>
                </View>
            )}
        </View>
    );
}
