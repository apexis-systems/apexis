import React, { useState } from 'react';
import {
    View, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import Svg, { Rect, Circle, Path, G, Line, Text as SvgText, Polyline } from 'react-native-svg';

// ── Mock data (same as web mockup) ───────────────────────────────────────────
const projectHealthData = [
    { id: 'p1', name: 'Jubilee Hills Residence', status: 'on-track', progress: 68, pulseScore: 92, tasksTotal: 120, tasksCompleted: 82, tasksPending: 30, tasksOverdue: 8, messagesThisWeek: 47, riskLevel: 'low', architect: 'Priya Sharma' },
    { id: 'p2', name: 'Banjara Hills Villa', status: 'delayed', progress: 42, pulseScore: 58, tasksTotal: 95, tasksCompleted: 40, tasksPending: 35, tasksOverdue: 20, messagesThisWeek: 12, riskLevel: 'high', architect: 'Kavitha Nair' },
    { id: 'p3', name: 'Red Hills Commercial', status: 'at-risk', progress: 25, pulseScore: 74, tasksTotal: 60, tasksCompleted: 15, tasksPending: 32, tasksOverdue: 13, messagesThisWeek: 23, riskLevel: 'medium', architect: 'Ravi Kumar' },
    { id: 'p4', name: 'Gachibowli Office Tower', status: 'on-track', progress: 85, pulseScore: 88, tasksTotal: 200, tasksCompleted: 170, tasksPending: 22, tasksOverdue: 8, messagesThisWeek: 38, riskLevel: 'low', architect: 'Priya Sharma' },
    { id: 'p5', name: 'Madhapur Tech Park', status: 'completed', progress: 100, pulseScore: 96, tasksTotal: 180, tasksCompleted: 180, tasksPending: 0, tasksOverdue: 0, messagesThisWeek: 3, riskLevel: 'low', architect: 'Kavitha Nair' },
] as const;

const teamMembers = [
    { id: 't1', name: 'Priya Sharma', role: 'Architect', tasksCompleted: 45, avgResponseTime: '2.1 hrs' },
    { id: 't2', name: 'Amit Patel', role: 'Site Engineer', tasksCompleted: 38, avgResponseTime: '3.5 hrs' },
    { id: 't3', name: 'Suresh Reddy', role: 'Contractor', tasksCompleted: 27, avgResponseTime: '6.2 hrs' },
    { id: 't4', name: 'Kavitha Nair', role: 'Interior Designer', tasksCompleted: 22, avgResponseTime: '1.8 hrs' },
    { id: 't5', name: 'Ravi Kumar', role: 'Structural Engineer', tasksCompleted: 31, avgResponseTime: '4.0 hrs' },
];

const taskCompletionWeekly = [
    { week: 'W1', completed: 18, created: 25 },
    { week: 'W2', completed: 22, created: 20 },
    { week: 'W3', completed: 15, created: 28 },
    { week: 'W4', completed: 30, created: 22 },
    { week: 'W5', completed: 25, created: 18 },
    { week: 'W6', completed: 28, created: 24 },
    { week: 'W7', completed: 32, created: 19 },
    { week: 'W8', completed: 20, created: 26 },
];

const fileUploadTimeline = [
    { day: 'Mon', uploads: 8 },
    { day: 'Tue', uploads: 12 },
    { day: 'Wed', uploads: 5 },
    { day: 'Thu', uploads: 15 },
    { day: 'Fri', uploads: 10 },
    { day: 'Sat', uploads: 3 },
    { day: 'Sun', uploads: 1 },
];

const communicationData = [
    { project: 'Jubilee', messages: 47 },
    { project: 'Banjara', messages: 12 },
    { project: 'Red Hills', messages: 23 },
    { project: 'Gachibowli', messages: 38 },
];

const activityFeed = [
    { id: 'af1', type: 'upload', description: 'Foundation Plan v3.pdf uploaded', project: 'Jubilee Hills', user: 'Priya Sharma', time: '10 min ago' },
    { id: 'af2', type: 'task', description: 'Electrical wiring inspection completed', project: 'Gachibowli', user: 'Amit Patel', time: '25 min ago' },
    { id: 'af3', type: 'comment', description: 'Contractor commented on excavation', project: 'Red Hills', user: 'Suresh Reddy', time: '1 hr ago' },
    { id: 'af4', type: 'revision', description: 'Drawing revision submitted for approval', project: 'Banjara Hills', user: 'Kavitha Nair', time: '2 hrs ago' },
    { id: 'af5', type: 'approval', description: 'BOQ approved by consultant', project: 'Jubilee Hills', user: 'Rajesh Kumar', time: '3 hrs ago' },
];

const pendingApprovals = [
    { id: 'ap1', title: 'Structural Drawing Rev.4', project: 'Banjara Hills Villa', requestedBy: 'Priya Sharma', daysWaiting: 5 },
    { id: 'ap2', title: 'BOQ Update — Electrical', project: 'Banjara Hills Villa', requestedBy: 'Amit Patel', daysWaiting: 3 },
    { id: 'ap3', title: 'Variation Order #12', project: 'Red Hills Commercial', requestedBy: 'Suresh Reddy', daysWaiting: 7 },
    { id: 'ap4', title: 'Interior Layout Plan', project: 'Banjara Hills Villa', requestedBy: 'Kavitha Nair', daysWaiting: 2 },
    { id: 'ap5', title: 'Foundation Photos — Batch 3', project: 'Red Hills', requestedBy: 'Amit Patel', daysWaiting: 1 },
];

const appUsageData = { dailyActiveUsers: 18, weeklyActiveUsers: 24, totalUsers: 32, engagementPercent: 75, mostActiveProject: 'Jubilee Hills Residence', leastActiveProject: 'Red Hills Commercial' };

// ── Color helpers ─────────────────────────────────────────────────────────────
const CHART_COLORS = { onTrack: '#22c55e', delayed: '#ef4444', atRisk: '#f59e0b', completed: '#3b82f6' };

const pulseColor = (score: number) => score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
const pulseLabel = (score: number) => score >= 85 ? 'Excellent' : score >= 65 ? 'Moderate' : 'Needs Attention';

const riskColor = (level: string) => level === 'low' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444';
const riskBg = (level: string) => level === 'low' ? 'rgba(34,197,94,0.12)' : level === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';

const activityIcon = (type: string) => {
    const map: Record<string, string> = { upload: 'upload', task: 'check-circle', comment: 'message-circle', approval: 'shield', revision: 'file-text' };
    return (map[type] || 'activity') as any;
};

const statusColor = (status: string) => {
    if (status === 'on-track') return CHART_COLORS.onTrack;
    if (status === 'delayed') return CHART_COLORS.delayed;
    if (status === 'at-risk') return CHART_COLORS.atRisk;
    return CHART_COLORS.completed;
};

// ── Custom Bar Chart (SVG) ────────────────────────────────────────────────────
function BarChartSVG({ data, colors }: { data: { week: string; completed: number; created: number }[]; colors: any }) {
    const W = Dimensions.get('window').width - 64;
    const H = 140;
    const MAX = 35;
    const barW = 10;
    const gap = (W - data.length * barW * 2 - 24) / (data.length + 1);

    return (
        <Svg width={W} height={H}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                <Line key={i} x1={12} y1={H - 20 - t * (H - 32)} x2={W - 4} y2={H - 20 - t * (H - 32)}
                    stroke={colors.border} strokeWidth={0.5} />
            ))}
            {data.map((d, i) => {
                const x = 12 + gap + i * (barW * 2 + gap);
                const hC = ((d.completed / MAX) * (H - 32));
                const hN = ((d.created / MAX) * (H - 32));
                return (
                    <G key={d.week}>
                        <Rect x={x} y={H - 20 - hC} width={barW} height={hC} fill={CHART_COLORS.onTrack} rx={2} />
                        <Rect x={x + barW + 1} y={H - 20 - hN} width={barW} height={hN} fill={colors.border} rx={2} />
                        <SvgText x={x + barW} y={H - 4} fontSize={8} fill={colors.textMuted} textAnchor="middle">{d.week}</SvgText>
                    </G>
                );
            })}
        </Svg>
    );
}

// ── Custom Line Chart (SVG) ───────────────────────────────────────────────────
function LineChartSVG({ data, primary, colors }: { data: { day: string; uploads: number }[]; primary: string; colors: any }) {
    const W = Dimensions.get('window').width - 64;
    const H = 120;
    const MAX = 18;
    const stepX = (W - 24) / (data.length - 1);

    const pts = data.map((d, i) => ({
        x: 12 + i * stepX,
        y: H - 20 - ((d.uploads / MAX) * (H - 32)),
    }));

    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <Svg width={W} height={H}>
            {[0, 0.5, 1].map((t, i) => (
                <Line key={i} x1={12} y1={H - 20 - t * (H - 32)} x2={W - 4} y2={H - 20 - t * (H - 32)}
                    stroke={colors.border} strokeWidth={0.5} />
            ))}
            <Polyline points={polyline} fill="none" stroke={primary} strokeWidth={2} />
            {pts.map((p, i) => (
                <G key={i}>
                    <Circle cx={p.x} cy={p.y} r={3} fill={primary} />
                    <SvgText x={p.x} y={H - 4} fontSize={8} fill={colors.textMuted} textAnchor="middle">{data[i].day}</SvgText>
                </G>
            ))}
        </Svg>
    );
}

// ── Donut Chart segments (SVG) ────────────────────────────────────────────────
function DonutChart({ slices, size = 120 }: { slices: { value: number; color: string; label: string }[]; size?: number }) {
    const cx = size / 2, cy = size / 2;
    const R = size / 2 - 8, r = size / 2 - 28;
    const total = slices.reduce((s, sl) => s + sl.value, 0);

    let angle = -Math.PI / 2;
    const paths: React.ReactElement[] = [];

    slices.forEach((sl, i) => {
        if (sl.value === 0) return;
        const sweep = (sl.value / total) * 2 * Math.PI;
        const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
        const x2 = cx + R * Math.cos(angle + sweep), y2 = cy + R * Math.sin(angle + sweep);
        const ix1 = cx + r * Math.cos(angle), iy1 = cy + r * Math.sin(angle);
        const ix2 = cx + r * Math.cos(angle + sweep), iy2 = cy + r * Math.sin(angle + sweep);
        const large = sweep > Math.PI ? 1 : 0;

        paths.push(
            <Path key={i}
                d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`}
                fill={sl.color}
            />
        );
        angle += sweep;
    });

    return (
        <Svg width={size} height={size}>
            {paths}
            <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#fff">{total}</SvgText>
            <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill="#aaa">Projects</SvgText>
        </Svg>
    );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
    const W = Dimensions.get('window').width - 200;
    const filled = (value / max) * W;
    return (
        <Svg width={W} height={6}>
            <Rect x={0} y={0} width={W} height={6} rx={3} fill="rgba(255,255,255,0.08)" />
            <Rect x={0} y={0} width={filled} height={6} rx={3} fill={color} />
        </Svg>
    );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
    const { colors } = useTheme();
    return (
        <View style={[{
            backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
            borderColor: colors.border, padding: 16, marginBottom: 12,
        }, style]}>
            {children}
        </View>
    );
}

function SectionTitle({ icon, title, badge }: { icon: string; title: string; badge?: number }) {
    const { colors } = useTheme();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Feather name={icon as any} size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }}>{title}</Text>
            {badge !== undefined && (
                <View style={{ backgroundColor: 'rgba(249,116,22,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>{badge}</Text>
                </View>
            )}
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminAnalyticsScreen() {
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'team'>('overview');

    // Access guard
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Feather name="shield" size={40} color={colors.border} />
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>Admin Analytics is restricted to admins.</Text>
            </SafeAreaView>
        );
    }

    // Aggregated stats
    const active = projectHealthData.filter(p => p.status !== 'completed');
    const pendingTasks = projectHealthData.reduce((s, p) => s + p.tasksPending, 0);
    const overdueTasks = projectHealthData.reduce((s, p) => s + p.tasksOverdue, 0);
    const delayed = projectHealthData.filter(p => p.status === 'delayed').length;

    const statusCounts = [
        { label: 'On Track', value: projectHealthData.filter(p => p.status === 'on-track').length, color: CHART_COLORS.onTrack },
        { label: 'Delayed', value: projectHealthData.filter(p => p.status === 'delayed').length, color: CHART_COLORS.delayed },
        { label: 'At Risk', value: projectHealthData.filter(p => p.status === 'at-risk').length, color: CHART_COLORS.atRisk },
        { label: 'Done', value: projectHealthData.filter(p => p.status === 'completed').length, color: CHART_COLORS.completed },
    ];

    const STAT_CARDS = [
        { label: 'Active Projects', value: active.length, icon: 'trending-up', accent: true },
        { label: 'Pending Tasks', value: pendingTasks, icon: 'clock', accent: false },
        { label: 'Overdue Tasks', value: overdueTasks, icon: 'alert-triangle', accent: false },
        { label: 'Delayed', value: delayed, icon: 'alert-circle', accent: false },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            {/* Page Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
                {/* Back row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 }}
                    >
                        <Feather name="arrow-left" size={18} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>Dashboard</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(249,116,22,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Feather name="shield" size={12} color={colors.primary} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>ADMIN</Text>
                    </View>
                </View>
                <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Admin Analytics</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Company-wide project intelligence</Text>
                </View>

                {/* Tab Switcher */}
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.border : '#e2e8f0', borderRadius: 10, padding: 3, marginTop: 12, gap: 2 }}>
                    {(['overview', 'projects', 'team'] as const).map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={{
                                flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
                                backgroundColor: activeTab === tab ? colors.surface : 'transparent',
                                ...(activeTab === tab && !isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}),
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? colors.text : colors.textMuted, textTransform: 'capitalize' }}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false}>

                {/* ── OVERVIEW TAB ───────────────────────────────── */}
                {activeTab === 'overview' && (
                    <>
                        {/* Quick Stats */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            {STAT_CARDS.map((s, i) => (
                                <View key={i} style={{
                                    width: '48.8%', backgroundColor: colors.surface, borderRadius: 14,
                                    borderWidth: 1, borderColor: colors.border, padding: 14,
                                    ...(s.accent ? { borderColor: colors.primary } : {}),
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Feather name={s.icon as any} size={14} color={s.accent ? colors.primary : colors.textMuted} />
                                        <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 26, fontWeight: '800', color: s.accent ? colors.primary : colors.text }}>{s.value}</Text>
                                </View>
                            ))}
                        </View>

                        {/* App Usage mini strip */}
                        <Card>
                            <SectionTitle icon="users" title="App Usage" />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {[
                                    { label: 'Daily Active', value: appUsageData.dailyActiveUsers },
                                    { label: 'Weekly Active', value: appUsageData.weeklyActiveUsers },
                                    { label: 'Total Users', value: appUsageData.totalUsers },
                                    { label: 'Engagement', value: `${appUsageData.engagementPercent}%` },
                                ].map((s, i) => (
                                    <View key={i} style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{s.value}</Text>
                                        <Text style={{ fontSize: 8, color: colors.textMuted, textAlign: 'center', marginTop: 2, textTransform: 'uppercase' }}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={{ marginTop: 10, gap: 3 }}>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>Most Active: <Text style={{ color: colors.text, fontWeight: '600' }}>{appUsageData.mostActiveProject}</Text></Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>Least Active: <Text style={{ color: colors.text, fontWeight: '600' }}>{appUsageData.leastActiveProject}</Text></Text>
                            </View>
                        </Card>

                        {/* Project Status Donut */}
                        <Card>
                            <SectionTitle icon="pie-chart" title="Project Status" />
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                                <DonutChart slices={statusCounts} size={120} />
                                <View style={{ flex: 1, gap: 8 }}>
                                    {statusCounts.map((s, i) => (
                                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                                            <Text style={{ flex: 1, fontSize: 11, color: colors.text }}>{s.label}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: s.color }}>{s.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </Card>

                        {/* Task Completion Bar Chart */}
                        <Card>
                            <SectionTitle icon="bar-chart-2" title="Task Completion Trend" />
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CHART_COLORS.onTrack }} />
                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>Completed</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.border }} />
                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>Created</Text>
                                </View>
                            </View>
                            <BarChartSVG data={taskCompletionWeekly} colors={colors} />
                        </Card>

                        {/* File Uploads Line Chart */}
                        <Card>
                            <SectionTitle icon="upload-cloud" title="File Uploads This Week" />
                            <LineChartSVG data={fileUploadTimeline} primary={colors.primary} colors={colors} />
                        </Card>

                        {/* Communication Activity */}
                        <Card>
                            <SectionTitle icon="message-circle" title="Communication Activity" />
                            {communicationData.map((c, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <Text style={{ fontSize: 10, color: colors.textMuted, width: 66 }} numberOfLines={1}>{c.project}</Text>
                                    <View style={{ flex: 1, height: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                                        <View style={{ width: `${(c.messages / 50) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 5 }} />
                                    </View>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, width: 26, textAlign: 'right' }}>{c.messages}</Text>
                                </View>
                            ))}
                        </Card>

                        {/* Live Activity Feed */}
                        <Card>
                            <SectionTitle icon="activity" title="Live Activity" />
                            {activityFeed.map((a, i) => (
                                <View key={a.id} style={{
                                    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                                    paddingVertical: 10, borderBottomWidth: i < activityFeed.length - 1 ? 1 : 0,
                                    borderBottomColor: colors.border,
                                }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name={activityIcon(a.type)} size={13} color={colors.textMuted} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, color: colors.text, lineHeight: 17 }}>{a.description}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{a.project} · {a.user} · {a.time}</Text>
                                    </View>
                                </View>
                            ))}
                        </Card>

                        {/* Pending Approvals */}
                        <Card>
                            <SectionTitle icon="clock" title="Pending Approvals" badge={pendingApprovals.length} />
                            {pendingApprovals.map((ap, i) => (
                                <View key={ap.id} style={{
                                    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                                    paddingVertical: 10, borderBottomWidth: i < pendingApprovals.length - 1 ? 1 : 0,
                                    borderBottomColor: colors.border,
                                }}>
                                    <Feather name="file-text" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }} numberOfLines={1}>{ap.title}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{ap.project} · {ap.requestedBy}</Text>
                                    </View>
                                    <View style={{
                                        backgroundColor: ap.daysWaiting >= 5 ? 'rgba(239,68,68,0.12)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                        borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
                                    }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: ap.daysWaiting >= 5 ? '#ef4444' : colors.textMuted }}>{ap.daysWaiting}d</Text>
                                    </View>
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* ── PROJECTS TAB ───────────────────────────────── */}
                {activeTab === 'projects' && (
                    <>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Project Pulse Scores</Text>
                        {projectHealthData.map((p, i) => (
                            <Card key={p.id} style={{ marginBottom: 10 }}>
                                {/* Project name + status badge */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{p.architect}</Text>
                                    </View>
                                    <View style={{ backgroundColor: riskBg(p.riskLevel), borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: riskColor(p.riskLevel), textTransform: 'uppercase' }}>{p.riskLevel} risk</Text>
                                    </View>
                                </View>

                                {/* Progress bar */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <View style={{ flex: 1, height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                        <View style={{ width: `${p.progress}%`, height: '100%', backgroundColor: statusColor(p.status), borderRadius: 3 }} />
                                    </View>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>{p.progress}%</Text>
                                </View>

                                {/* Stats row */}
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {/* Pulse Score */}
                                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 8 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: pulseColor(p.pulseScore) }}>{p.pulseScore}</Text>
                                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 1, textAlign: 'center' }}>Pulse</Text>
                                        <Text style={{ fontSize: 7, color: pulseColor(p.pulseScore), fontWeight: '600', marginTop: 1 }}>{pulseLabel(p.pulseScore)}</Text>
                                    </View>
                                    {/* Tasks */}
                                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 8 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{p.tasksCompleted}<Text style={{ fontSize: 12, color: colors.textMuted }}>/{p.tasksTotal}</Text></Text>
                                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 1 }}>Tasks Done</Text>
                                    </View>
                                    {/* Overdue */}
                                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: p.tasksOverdue > 10 ? 'rgba(239,68,68,0.08)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 8 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: p.tasksOverdue > 10 ? '#ef4444' : colors.text }}>{p.tasksOverdue}</Text>
                                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 1 }}>Overdue</Text>
                                    </View>
                                    {/* Messages */}
                                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 8 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{p.messagesThisWeek}</Text>
                                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 1, textAlign: 'center' }}>Msgs/wk</Text>
                                    </View>
                                </View>
                            </Card>
                        ))}
                    </>
                )}

                {/* ── TEAM TAB ───────────────────────────────────── */}
                {activeTab === 'team' && (
                    <>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Team Leaderboard</Text>
                        <Card>
                            {teamMembers.map((m, i) => (
                                <View key={m.id} style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    paddingVertical: 12,
                                    borderBottomWidth: i < teamMembers.length - 1 ? 1 : 0,
                                    borderBottomColor: colors.border,
                                }}>
                                    {/* Rank */}
                                    <View style={{
                                        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: i < 3 ? 'rgba(249,116,22,0.15)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: i < 3 ? colors.primary : colors.textMuted }}>{i + 1}</Text>
                                    </View>
                                    {/* Info */}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{m.name}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{m.role}</Text>
                                        <View style={{ marginTop: 6 }}>
                                            <HBar value={m.tasksCompleted} max={50} color={i < 3 ? colors.primary : CHART_COLORS.onTrack} />
                                        </View>
                                    </View>
                                    {/* Stats */}
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{m.tasksCompleted}</Text>
                                        <Text style={{ fontSize: 9, color: colors.textMuted }}>tasks</Text>
                                        <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>avg {m.avgResponseTime}</Text>
                                    </View>
                                </View>
                            ))}
                        </Card>

                        {/* Response time chart */}
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Response Times</Text>
                        <Card>
                            {teamMembers.map((m, i) => {
                                const hours = parseFloat(m.avgResponseTime);
                                const maxHours = 8;
                                return (
                                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, width: 70 }} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                                        <View style={{ flex: 1, height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                                            <View style={{ width: `${(hours / maxHours) * 100}%`, height: '100%', backgroundColor: hours <= 3 ? CHART_COLORS.onTrack : hours <= 5 ? CHART_COLORS.atRisk : CHART_COLORS.delayed, borderRadius: 4 }} />
                                        </View>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, width: 38, textAlign: 'right' }}>{m.avgResponseTime}</Text>
                                    </View>
                                );
                            })}
                        </Card>
                    </>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}
