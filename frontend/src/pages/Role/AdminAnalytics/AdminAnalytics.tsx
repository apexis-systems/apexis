"use client";

import { useState, useEffect } from 'react';
import {
    TrendingUp, Clock, AlertTriangle, Users, Activity, Upload,
    CheckCircle2, MessageSquare, FileText, Shield, BarChart2,
    Loader2,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getAnalyticsOverview } from '@/services/analyticsService';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CHART_COLORS = { onTrack: '#22c55e', delayed: '#ef4444', atRisk: '#f59e0b', completed: '#3b82f6' };

const pulseColor = (score: number) => score >= 85 ? 'text-green-500' : score >= 65 ? 'text-yellow-500' : 'text-red-500';

const activityIcons: Record<string, React.ElementType> = {
    upload: Upload, task: CheckCircle2, comment: MessageSquare, approval: Shield, revision: FileText,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    const pulseLabel = (score: number) => score >= 85 ? t('excellent') : score >= 65 ? t('moderate') : t('attention_needed');

    const riskBadge = (level: string) => {
        const cls: Record<string, string> = {
            low: 'bg-green-500/10 text-green-600 dark:text-green-400',
            medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
            high: 'bg-red-500/10 text-red-600 dark:text-red-400',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cls[level] || ''}`}>
                {t(level)}
            </span>
        );
    };

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
                <p className="text-sm text-muted-foreground">{t('access_restricted_admins')}</p>
                <button
                    onClick={() => router.back()}
                    className="text-xs text-accent font-medium hover:underline"
                >
                    ← {t('go_back')}
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
                        {t('admin_analytics')}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('analytics_subtitle')}</p>
                </div>
                <button
                    onClick={() => router.back()}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                    ← {t('go_back')}
                </button>
            </div>

            {/* ── Quick Stats Row ────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: t('active_projects'), value: quickStats.activeProjects, icon: TrendingUp, accent: true, path: `/${user.role}/dashboard` },
                    { label: t('tasks_pending'), value: quickStats.pendingTasks, icon: Clock, accent: false, path: `/${user.role}/snags` },
                    { label: t('tasks_overdue'), value: quickStats.overdueTasks, icon: AlertTriangle, accent: false, path: `/${user.role}/snags` },
                    { label: t('delayed_projects'), value: quickStats.delayedProjects, icon: AlertCircle, accent: false, path: `/${user.role}/dashboard` },
                    { label: t('avg_completion'), value: quickStats.avgCompletion + '%', icon: CheckCircle, accent: false, path: null },
                ].map((s, i) => (
                    <div
                        key={i}
                        onClick={() => s.path && router.push(s.path)}
                        className={`rounded-xl bg-card border p-4 transition-all duration-200 ${s.path ? 'cursor-pointer hover:border-accent group' : ''} ${s.accent ? 'border-accent shadow-sm shadow-accent/5' : 'border-border'}`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <s.icon className={`h-4 w-4 ${s.accent ? 'text-accent' : 'text-muted-foreground group-hover:text-accent transition-colors'}`} />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-accent transition-colors whitespace-nowrap">{s.label}</span>
                        </div>
                        <div className={`text-2xl font-bold ${s.accent ? 'text-accent' : 'text-foreground'}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Project Status Donut */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-accent" /> {t('project_status')}
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
                        <BarChart2 className="h-3.5 w-3.5 text-accent" /> {t('task_completion_trend')}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={taskCompletion} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="completed" fill={CHART_COLORS.onTrack} radius={[3, 3, 0, 0]} name={t('completed_label')} />
                            <Bar dataKey="created" fill="hsl(var(--border))" radius={[3, 3, 0, 0]} name={t('created_label')} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Communication Activity */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-accent" /> {t('communication_activity')}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={communication} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis dataKey="project" type="category" tick={{ fontSize: 9 }} width={80} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="messages" fill="hsl(var(--accent))" radius={[0, 3, 3, 0]} name={t('messages_week')} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Project Pulse Score Table ─────────────────────────── */}
            <div className="rounded-xl bg-card border border-border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-accent" /> {t('project_pulse_score')}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="text-left py-2 font-medium">{t('projects')}</th>
                                <th className="text-center py-2 font-medium">{t('pulse')}</th>
                                <th className="text-center py-2 font-medium">{t('progress')}</th>
                                <th className="text-center py-2 font-medium">{t('snags_pt')}</th>
                                <th className="text-center py-2 font-medium">{t('rfis_pt')}</th>
                                <th className="text-center py-2 font-medium">{t('overdue')}</th>
                                <th className="text-center py-2 font-medium">{t('risk')}</th>
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
                                    <td className="text-center text-foreground font-medium">
                                        <span className="text-orange-500">{p.snagStats?.pending || 0}</span>
                                        <span className="text-muted-foreground mx-1">/</span>
                                        <span>{p.snagStats?.total || 0}</span>
                                    </td>
                                    <td className="text-center text-foreground font-medium">
                                        <span className="text-blue-500">{p.rfiStats?.pending || 0}</span>
                                        <span className="text-muted-foreground mx-1">/</span>
                                        <span>{p.rfiStats?.total || 0}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className={p.overdue > 0 ? 'text-red-500 font-semibold' : 'text-foreground'}>
                                            {p.overdue}
                                        </span>
                                    </td>
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
                        <Users className="h-3.5 w-3.5 text-accent" /> {t('team_leaderboard')}
                    </h3>
                    <div className="space-y-2.5">
                        {teamLeaderboard.map((m: any, i: number) => (
                            <div key={m.id} className="flex items-center gap-3">
                                <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${i < 3 ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{m.role} • {m.projectName}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-foreground">{t('tasks_count').replace('{count}', String(m.tasksCompleted))}</p>
                                    <p className="text-[9px] text-muted-foreground">{t('avg_label')} {m.avgResponseTime}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-accent" /> {t('live_activity')}
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

                {/* Project Issue Stats */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-accent" /> {t('critical_issue_summary')}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                            <div>
                                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{t('open_snags')}</p>
                                <p className="text-xl font-bold text-orange-700">{quickStats.pendingTasks}</p>
                            </div>
                            <Activity className="h-8 w-8 text-orange-500/20" />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                            <div>
                                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">{t('overdue_items')}</p>
                                <p className="text-xl font-bold text-red-700">{quickStats.overdueTasks}</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-red-500/20" />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                            <div>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{t('active_rfis')}</p>
                                <p className="text-xl font-bold text-blue-700">
                                    {projectPulse.reduce((acc: number, p: any) => acc + (p.rfiStats?.pending || 0), 0)}
                                </p>
                            </div>
                            <FileText className="h-8 w-8 text-blue-500/20" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── File Uploads ──────────────────────────── */}
            <div className="grid grid-cols-1 gap-4">

                {/* File Upload Line Chart */}
                <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Upload className="h-3.5 w-3.5 text-accent" /> {t('file_uploads_week')}
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


            </div>

        </div>
    );
}

