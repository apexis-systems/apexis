import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { mockReports } from '@/data/mock';

interface Props {
    project: Project;
    userRole: UserRole;
}

export default function ProjectOverview({ project, userRole }: Props) {
    const reports = mockReports.filter((r) => r.projectId === project.id);
    const dailyReports = reports.filter((r) => r.type === 'daily');
    const weeklyReports = reports.filter((r) => r.type === 'weekly');

    return (
        <View style={{ gap: 16 }}>
            {/* Stats Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[
                    { icon: 'calendar', label: 'Start Date', value: project.startDate },
                    { icon: 'calendar', label: 'End Date', value: project.endDate },
                    { icon: 'file-text', label: 'Documents', value: String(project.totalDocs) },
                    { icon: 'camera', label: 'Photos', value: String(project.totalPhotos) },
                ].map((item) => (
                    <View
                        key={item.label}
                        style={{
                            width: '47%',
                            borderRadius: 14,
                            backgroundColor: '#111111',
                            borderWidth: 1,
                            borderColor: '#2a2a2a',
                            padding: 14,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Feather name={item.icon as any} size={14} color="#888" />
                            <Text style={{ fontSize: 11, color: '#888' }}>{item.label}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{item.value}</Text>
                    </View>
                ))}
            </View>

            {/* Reports */}
            <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Reports</Text>
                    {userRole === 'admin' && (
                        <TouchableOpacity
                            onPress={() => Alert.alert('Info', 'Upload report functionality')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                borderRadius: 8,
                                backgroundColor: '#f97316',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                            }}
                        >
                            <Feather name="upload" size={12} color="#fff" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>Upload Report</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {dailyReports.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Daily Site Reports</Text>
                        <View style={{ gap: 6 }}>
                            {dailyReports.map((report) => (
                                <View
                                    key={report.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                        borderRadius: 12,
                                        backgroundColor: '#111111',
                                        borderWidth: 1,
                                        borderColor: '#2a2a2a',
                                        padding: 10,
                                    }}
                                >
                                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="file-text" size={16} color="#888" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>{report.title}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Feather name="clock" size={9} color="#555" />
                                            <Text style={{ fontSize: 9, color: '#555' }}>{report.date} · {report.uploader}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {weeklyReports.length > 0 && (
                    <View>
                        <Text style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Weekly Progress Reports</Text>
                        <View style={{ gap: 6 }}>
                            {weeklyReports.map((report) => (
                                <View
                                    key={report.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                        borderRadius: 12,
                                        backgroundColor: '#111111',
                                        borderWidth: 1,
                                        borderColor: '#2a2a2a',
                                        padding: 10,
                                    }}
                                >
                                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="file-text" size={16} color="#f97316" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>{report.title}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Feather name="clock" size={9} color="#555" />
                                            <Text style={{ fontSize: 9, color: '#555' }}>{report.date} · {report.uploader}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            {userRole === 'admin' && (
                <TouchableOpacity
                    style={{
                        height: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#2a2a2a',
                        borderStyle: 'dashed',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                    }}
                >
                    <Feather name="download" size={15} color="#888" />
                    <Text style={{ fontSize: 13, color: '#888' }}>Export Final Handover Package</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
