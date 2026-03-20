"use client";

import { useState, useEffect } from 'react';
import {
    TrendingUp, Clock, AlertTriangle, Users, Activity, Upload,
    CheckCircle2, MessageSquare, FileText, Shield, BarChart2,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getAnalyticsOverview } from '@/services/analyticsService';

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
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const results = await getAnalyticsOverview();
                setData(results);
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchAnalytics();
    }, [user]);

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

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    const {
        quickStats, projectStatus, projectPulse, teamLeaderboard,
        activityFeed, fileUploadTimeline, appUsage, communication,
        pendingApprovals, taskCompletion
    } = data;

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
                    { label: 'Active Projects', value: quickStats.activeProjects, icon: TrendingUp, accent: true },
                    { label: 'Tasks Pending', value: quickStats.pendingTasks, icon: Clock, accent: false },
                    { label: 'Tasks Overdue', value: quickStats.overdueTasks, icon: AlertTriangle, accent: false },
                    { label: 'Delayed Projects', value: quickStats.delayedProjects, icon: AlertTriangle, accent: false },
                    { label: 'Team Activity', value: `${quickStats.engagementPercent}%`, icon: Users, accent: false },
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
                            <Pie data={projectStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                {projectStatus.map((entry: any, i: number) => (
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
                        <BarChart data={taskCompletion} barGap={2}>
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
                        <BarChart data={communication} layout="vertical">
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
                            {projectPulse.map((p: any) => (
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
                                    <td className="text-center text-foreground">{p.tasksDone}/{p.tasksTotal}</td>
                                    <td className="text-center">
                                        <span className={p.overdue > 10 ? 'text-red-500 font-semibold' : 'text-foreground'}>
                                            {p.overdue}
                                        </span>
                                    </td>
                                    <td className="text-center text-foreground">{p.messages}</td>
                                    <td className="text-center">{riskBadge(p.risk)}</td>
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
                        {teamLeaderboard.map((m: any, i: number) => (
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
                        {activityFeed.map((a: any) => {
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
                        {pendingApprovals.map((ap: any) => (
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
                            { label: 'Daily Active', value: appUsage.dailyActive },
                            { label: 'Weekly Active', value: appUsage.weeklyActive },
                            { label: 'Total Users', value: appUsage.total },
                            { label: 'Engagement', value: `${appUsage.engagement}%` },
                        ].map((s, i) => (
                            <div key={i} className="rounded-lg bg-secondary/50 p-3 text-center">
                                <div className="text-lg font-bold text-foreground">{s.value}</div>
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                            Most Active: <span className="text-foreground font-medium">{appUsage.mostActive}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            Least Active: <span className="text-foreground font-medium">{appUsage.leastActive}</span>
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
