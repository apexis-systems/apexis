import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, UserRole } from '@/types';
import { mockReports } from '@/data/mock';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    project: Project;
    userRole: UserRole;
}

export default function ProjectDailyReports({ project, userRole }: Props) {
    const { colors } = useTheme();
    const dailyReports = mockReports.filter(
        (r) => r.projectId === project.id && r.type === 'daily'
    );

    return (
        <View>
            {userRole !== 'client' && (
                <TouchableOpacity
                    onPress={() => Alert.alert('Info', 'Upload daily report functionality')}
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
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Daily Report</Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 6 }}>
                {dailyReports.map((report) => (
                    <View
                        key={report.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 10,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 10,
                        }}
                    >
                        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="file-text" size={16} color="#f97316" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>{report.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <Feather name="calendar" size={9} color="#555" />
                                <Text style={{ fontSize: 9, color: colors.textMuted }}>{report.date} · {report.uploader}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {dailyReports.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="file-text" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No daily reports yet</Text>
                </View>
            )}
        </View>
    );
}
