"use client";

import {
    TrendingUp, Clock, AlertTriangle, Users, Activity, Upload,
    CheckCircle2, MessageSquare, FileText, Shield, BarChart2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Mock data (mirrored from mockup) ─────────────────────────────────────────
const projectHealthData = [
    { id: 'p1', name: 'Jubilee Hills Residence', status: 'on-track', progress: 68, pulseScore: 92, tasksTotal: 120, tasksCompleted: 82, tasksPending: 30, tasksOverdue: 8, messagesThisWeek: 47, riskLevel: 'low', architect: 'Priya Sharma' },
    { id: 'p2', name: 'Banjara Hills Villa', status: 'delayed', progress: 42, pulseScore: 58, tasksTotal: 95, tasksCompleted: 40, tasksPending: 35, tasksOverdue: 20, messagesThisWeek: 12, riskLevel: 'high', architect: 'Kavitha Nair' },
    { id: 'p3', name: 'Red Hills Commercial', status: 'at-risk', progress: 25, pulseScore: 74, tasksTotal: 60, tasksCompleted: 15, tasksPending: 32, tasksOverdue: 13, messagesThisWeek: 23, riskLevel: 'medium', architect: 'Ravi Kumar' },
    { id: 'p4', name: 'Gachibowli Office Tower', status: 'on-track', progress: 85, pulseScore: 88, tasksTotal: 200, tasksCompleted: 170, tasksPending: 22, tasksOverdue: 8, messagesThisWeek: 38, riskLevel: 'low', architect: 'Priya Sharma' },
    { id: 'p5', name: 'Madhapur Tech Park', status: 'completed', progress: 100, pulseScore: 96, tasksTotal: 180, tasksCompleted: 180, tasksPending: 0, tasksOverdue: 0, messagesThisWeek: 3, riskLevel: 'low', architect: 'Kavitha Nair' },
];

const teamMembers = [
    { id: 't1', name: 'Priya Sharma', role: 'Architect', tasksCompleted: 45, avgResponseTime: '2.1 hrs', filesUploaded: 34, messagesSent: 156 },
    { id: 't2', name: 'Amit Patel', role: 'Site Engineer', tasksCompleted: 38, avgResponseTime: '3.5 hrs', filesUploaded: 28, messagesSent: 210 },
    { id: 't3', name: 'Suresh Reddy', role: 'Contractor', tasksCompleted: 27, avgResponseTime: '6.2 hrs', filesUploaded: 12, messagesSent: 89 },
    { id: 't4', name: 'Kavitha Nair', role: 'Interior Designer', tasksCompleted: 22, avgResponseTime: '1.8 hrs', filesUploaded: 19, messagesSent: 134 },
    { id: 't5', name: 'Ravi Kumar', role: 'Structural Engineer', tasksCompleted: 31, avgResponseTime: '4.0 hrs', filesUploaded: 22, messagesSent: 98 },
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

const communicationData = [
    { project: 'Jubilee Hills', messages: 47, avgReplyHrs: 2.1 },
    { project: 'Banjara Hills', messages: 12, avgReplyHrs: 8.4 },
    { project: 'Red Hills', messages: 23, avgReplyHrs: 5.2 },
    { project: 'Gachibowli', messages: 38, avgReplyHrs: 3.0 },
];

const activityFeed = [
    { id: 'af1', type: 'upload', description: 'Foundation Plan v3.pdf uploaded', project: 'Jubilee Hills Residence', user: 'Priya Sharma', time: '10 min ago' },
    { id: 'af2', type: 'task', description: 'Electrical wiring inspection completed', project: 'Gachibowli Office Tower', user: 'Amit Patel', time: '25 min ago' },
    { id: 'af3', type: 'comment', description: 'Contractor commented on excavation progress', project: 'Red Hills Commercial', user: 'Suresh Reddy', time: '1 hr ago' },
    { id: 'af4', type: 'revision', description: 'Drawing revision submitted for approval', project: 'Banjara Hills Villa', user: 'Kavitha Nair', time: '2 hrs ago' },
    { id: 'af5', type: 'approval', description: 'BOQ approved by consultant', project: 'Jubilee Hills Residence', user: 'Rajesh Kumar', time: '3 hrs ago' },
    { id: 'af6', type: 'upload', description: '12 new site photos added', project: 'Gachibowli Office Tower', user: 'Amit Patel', time: '4 hrs ago' },
];

const pendingApprovals = [
    { id: 'ap1', title: 'Structural Drawing Rev.4', project: 'Banjara Hills Villa', requestedBy: 'Priya Sharma', daysWaiting: 5 },
    { id: 'ap2', title: 'BOQ Update — Electrical', project: 'Banjara Hills Villa', requestedBy: 'Amit Patel', daysWaiting: 3 },
    { id: 'ap3', title: 'Variation Order #12', project: 'Red Hills Commercial', requestedBy: 'Suresh Reddy', daysWaiting: 7 },
    { id: 'ap4', title: 'Interior Layout Plan', project: 'Banjara Hills Villa', requestedBy: 'Kavitha Nair', daysWaiting: 2 },
    { id: 'ap5', title: 'Foundation Photos — Batch 3', project: 'Red Hills Commercial', requestedBy: 'Amit Patel', daysWaiting: 1 },
    { id: 'ap6', title: 'HVAC Duct Layout', project: 'Gachibowli Office Tower', requestedBy: 'Ravi Kumar', daysWaiting: 4 },
    { id: 'ap7', title: 'Landscape Plan Rev.2', project: 'Banjara Hills Villa', requestedBy: 'Priya Sharma', daysWaiting: 6 },
];

const appUsageData = {
    dailyActiveUsers: 18, weeklyActiveUsers: 24, totalUsers: 32, engagementPercent: 75,
    mostActiveProject: 'Jubilee Hills Residence', leastActiveProject: 'Red Hills Commercial',
};

const fileUploadTimeline = [
    { day: 'Mon', uploads: 8 }, { day: 'Tue', uploads: 12 }, { day: 'Wed', uploads: 5 },
    { day: 'Thu', uploads: 15 }, { day: 'Fri', uploads: 10 }, { day: 'Sat', uploads: 3 }, { day: 'Sun', uploads: 1 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const CHART_COLORS = { onTrack: '#22c55e', delayed: '#ef4444', atRisk: '#f59e0b', completed: '#3b82f6' };

const pulseColor = (score: number) => score >= 85 ? 'text-green-500' : score >= 65 ? 'text-yellow-500' : 'text-red-500';
const pulseLabel = (score: number) => score >= 85 ? 'Excellent' : score >= 65 ? 'Moderate' : 'Attention Needed';

const riskBadge = (level: string) => {
    const cls: Record<string, string> = {
        low: 'bg-green-500/10 text-green-600 dark:text-green-400',
        medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
        high: 'bg-red-500/10 text-red-600 dark:text-red-400',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cls[level] || ''}`}>
            {level}
        </span>
    );
};

const activityIcons: Record<string, React.ElementType> = {
    upload: Upload, task: CheckCircle2, comment: MessageSquare, approval: Shield, revision: FileText,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
    const { user } = useAuth();
    const router = useRouter();

    // Access guard
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-6">
                <Shield className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Access restricted to admins.</p>
                <button
                    onClick={() => router.back()}
                    className="text-xs text-accent font-medium hover:underline"
                >
                    ← Go Back
                </button>
            </div>
        );
    }

    // Aggregated stats
    const active = projectHealthData.filter(p => p.status !== 'completed');
    const pendingTasks = projectHealthData.reduce((s, p) => s + p.tasksPending, 0);
    const overdueTasks = projectHealthData.reduce((s, p) => s + p.tasksOverdue, 0);
    const delayed = projectHealthData.filter(p => p.status === 'delayed').length;

    const statusCounts = [
        { name: 'On Track', value: projectHealthData.filter(p => p.status === 'on-track').length, color: CHART_COLORS.onTrack },
        { name: 'Delayed', value: projectHealthData.filter(p => p.status === 'delayed').length, color: CHART_COLORS.delayed },
        { name: 'At Risk', value: projectHealthData.filter(p => p.status === 'at-risk').length, color: CHART_COLORS.atRisk },
        { name: 'Completed', value: projectHealthData.filter(p => p.status === 'completed').length, color: CHART_COLORS.completed },
    ];

    const tooltipStyle = {
        fontSize: 11, borderRadius: 8,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))',
    };

    return (
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-accent" />
                        Admin Analytics
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Company-wide project intelligence</p>
                </div>
                <button
                    onClick={() => router.back()}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                    ← Dashboard
                </button>
            </div>

            {/* ── Quick Stats Row ────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Active Projects', value: active.length, icon: TrendingUp, accent: true },
                    { label: 'Tasks Pending', value: pendingTasks, icon: Clock, accent: false },
                    { label: 'Tasks Overdue', value: overdueTasks, icon: AlertTriangle, accent: false },
                    { label: 'Delayed Projects', value: delayed, icon: AlertTriangle, accent: false },
                    { label: 'Team Activity', value: `${appUsageData.engagementPercent}%`, icon: Users, accent: false },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl bg-card border p-4 flex flex-col gap-1 ${s.accent ? 'border-accent/30' : 'border-border'}`}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <s.icon className={`h-4 w-4 ${s.accent ? 'text-accent' : ''}`} />
                            <span className="text-[10px] font-medium uppercase tracking-wide">{s.label}</span>
                        </div>
                        <span className={`text-2xl font-bold ${s.accent ? 'text-accent' : 'text-foreground'}`}>{s.value}</span>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Project Status Donut */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-accent" /> Project Status
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                {statusCounts.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Task Completion Bar Chart */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <BarChart2 className="h-3.5 w-3.5 text-accent" /> Task Completion Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={taskCompletionWeekly} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="completed" fill={CHART_COLORS.onTrack} radius={[3, 3, 0, 0]} name="Completed" />
                            <Bar dataKey="created" fill="hsl(var(--border))" radius={[3, 3, 0, 0]} name="Created" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Communication Activity */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-accent" /> Communication Activity
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={communicationData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis dataKey="project" type="category" tick={{ fontSize: 9 }} width={80} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="messages" fill="hsl(var(--accent))" radius={[0, 3, 3, 0]} name="Messages this week" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Project Pulse Score Table ─────────────────────────── */}
            <div className="rounded-xl bg-card border border-border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-accent" /> Project Pulse Score
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="text-left py-2 font-medium">Project</th>
                                <th className="text-center py-2 font-medium">Pulse Score</th>
                                <th className="text-center py-2 font-medium">Progress</th>
                                <th className="text-center py-2 font-medium">Tasks Done</th>
                                <th className="text-center py-2 font-medium">Overdue</th>
                                <th className="text-center py-2 font-medium">Messages/wk</th>
                                <th className="text-center py-2 font-medium">Risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectHealthData.map(p => (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                                    <td className="py-2.5">
                                        <span className="font-medium text-foreground block">{p.name}</span>
                                        <span className="text-[9px] text-muted-foreground">{p.architect}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`font-bold text-sm ${pulseColor(p.pulseScore)}`}>{p.pulseScore}</span>
                                        <span className="block text-[9px] text-muted-foreground">{pulseLabel(p.pulseScore)}</span>
                                    </td>
                                    <td className="text-center">
                                        <div className="mx-auto w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-accent"
                                                style={{ width: `${p.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] text-muted-foreground">{p.progress}%</span>
                                    </td>
                                    <td className="text-center text-foreground">{p.tasksCompleted}/{p.tasksTotal}</td>
                                    <td className="text-center">
                                        <span className={p.tasksOverdue > 10 ? 'text-red-500 font-semibold' : 'text-foreground'}>
                                            {p.tasksOverdue}
                                        </span>
                                    </td>
                                    <td className="text-center text-foreground">{p.messagesThisWeek}</td>
                                    <td className="text-center">{riskBadge(p.riskLevel)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Team / Activity / Approvals Row ──────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Team Leaderboard */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-accent" /> Team Leaderboard
                    </h3>
                    <div className="space-y-2.5">
                        {teamMembers.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3">
                                <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${i < 3 ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-foreground">{m.tasksCompleted} tasks</p>
                                    <p className="text-[9px] text-muted-foreground">Avg: {m.avgResponseTime}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-accent" /> Live Activity
                    </h3>
                    <div className="space-y-1">
                        {activityFeed.map(a => {
                            const Icon = activityIcons[a.type] || Activity;
                            return (
                                <div key={a.id} className="flex items-start gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                                    <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-foreground leading-tight">{a.description}</p>
                                        <p className="text-[9px] text-muted-foreground">{a.project} · {a.user} · {a.time}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pending Approvals */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-accent" /> Pending Approvals
                        <span className="ml-auto bg-accent/15 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {pendingApprovals.length}
                        </span>
                    </h3>
                    <div className="space-y-1">
                        {pendingApprovals.map(ap => (
                            <div key={ap.id} className="flex items-start gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                                <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-foreground font-medium truncate">{ap.title}</p>
                                    <p className="text-[9px] text-muted-foreground">{ap.project} · {ap.requestedBy}</p>
                                </div>
                                <span className={`text-[10px] font-semibold whitespace-nowrap ${ap.daysWaiting >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {ap.daysWaiting}d
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── File Uploads + App Usage ──────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* File Upload Line Chart */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Upload className="h-3.5 w-3.5 text-accent" /> File Uploads This Week
                    </h3>
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={fileUploadTimeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Line
                                type="monotone"
                                dataKey="uploads"
                                stroke="hsl(var(--accent))"
                                strokeWidth={2}
                                dot={{ fill: 'hsl(var(--accent))', r: 3 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* App Usage */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-accent" /> App Usage
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Daily Active', value: appUsageData.dailyActiveUsers },
                            { label: 'Weekly Active', value: appUsageData.weeklyActiveUsers },
                            { label: 'Total Users', value: appUsageData.totalUsers },
                            { label: 'Engagement', value: `${appUsageData.engagementPercent}%` },
                        ].map((s, i) => (
                            <div key={i} className="rounded-lg bg-secondary/50 p-3 text-center">
                                <div className="text-lg font-bold text-foreground">{s.value}</div>
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                            Most Active: <span className="text-foreground font-medium">{appUsageData.mostActiveProject}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            Least Active: <span className="text-foreground font-medium">{appUsageData.leastActiveProject}</span>
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
