"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  Building2,
  Camera,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  FolderKanban,
  HardDrive,
  HeartPulse,
  Lightbulb,
  MessageSquare,
  Monitor,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SUPERADMIN_SECTION_HIGHLIGHT_EVENT } from "@/components/superadmin/SuperadminSidebar";
import { cn } from "@/lib/utils";
import { getDashboardOverview } from "@/services/superadminService";
import { useSocket } from "@/contexts/SocketContext";

const chartGridStroke = "hsl(214,20%,90%)";
const chartTickColor = "hsl(215,10%,45%)";


const cardClass =
  "rounded border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]";
const mutedTextClass =
  "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";
const strongTextClass =
  "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";

const severityStyles: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  info: "bg-sky-500/10 border-sky-500/20 text-sky-500",
};

const riskColors: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

const riskLabels: Record<string, string> = {
  green: "Healthy",
  yellow: "Attention",
  red: "Critical",
};

const activityBadge: Record<string, string> = {
  High: "bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)]",
  Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Low: "bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)] dark:bg-[hsl(30_6%_18%)] dark:text-[hsl(38_10%_55%)]",
};

const projectHealthStatus = {
  healthy: {
    label: "Healthy",
    dot: "bg-emerald-500",
    progress: "bg-emerald-500",
  },
  attention: {
    label: "Attention",
    dot: "bg-amber-500",
    progress: "bg-amber-500",
  },
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    progress: "bg-red-500",
  },
};

const scrollSectionClass = "scroll-mt-24";

const metricChangeClass: Record<"up" | "down" | "neutral", string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: mutedTextClass,
};

function useHashScroll() {
  const [highlightedSection, setHighlightedSection] = useState("");

  useEffect(() => {
    let timeoutId: number | undefined;

    const highlightSection = (sectionId: string) => {
      if (!sectionId) return;

      setHighlightedSection("");
      window.requestAnimationFrame(() => {
        setHighlightedSection(sectionId);
      });

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        setHighlightedSection((current) =>
          current === sectionId ? "" : current,
        );
      }, 1400);
    };

    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;

      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightSection(hash);
      });
    };

    const handleHighlight = (event: Event) => {
      const sectionId = (event as CustomEvent<string>).detail;
      highlightSection(sectionId);
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    window.addEventListener(
      SUPERADMIN_SECTION_HIGHLIGHT_EVENT,
      handleHighlight as EventListener,
    );

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("hashchange", scrollToHash);
      window.removeEventListener(
        SUPERADMIN_SECTION_HIGHLIGHT_EVENT,
        handleHighlight as EventListener,
      );
    };
  }, []);

  return highlightedSection;
}

function MetricCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  sparkline,
}: {
  title: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  icon: typeof Building2;
  sparkline: number[];
}) {
  const max = Math.max(...sparkline);
  const min = Math.min(...sparkline);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = sparkline
    .map((valuePoint, index) => `${(index / (sparkline.length - 1)) * width},${height - ((valuePoint - min) / range) * height}`)
    .join(" ");

  return (
    <div className={cn(cardClass, "relative overflow-hidden p-4")}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-[hsl(24_95%_53%/0.1)]">
          <Icon className="h-3.5 w-3.5 text-[hsl(24_95%_53%)]" />
        </div>
        <span className={cn("text-xs font-medium uppercase tracking-wide", mutedTextClass)}>
          {title}
        </span>
      </div>
      <div className={cn("text-2xl font-bold", strongTextClass)}>{value}</div>
      <div className={cn("mt-1 text-xs font-medium", metricChangeClass[changeType])}>
        {change}
      </div>
      <svg width={width} height={height} className="absolute bottom-3 right-3 opacity-30">
        <polyline
          fill="none"
          stroke="hsl(25 95% 53%)"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    </div>
  );
}

const SummaryPill = ({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) => (
  <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold", className)}>
    {children}
  </span>
);

const activityIconMap: Record<string, any> = {
  upload_photo: Camera,
  upload: Upload,
  snag_update: CheckCircle,
  rfi_update: AlertCircle,
  message: MessageSquare,
  default: Activity
};

const activityColorMap: Record<string, string> = {
  upload_photo: "text-[hsl(24_95%_53%)]",
  upload: "text-sky-500",
  snag_update: "text-emerald-600 dark:text-emerald-400",
  rfi_update: "text-amber-500",
  message: "text-sky-500",
  default: "text-gray-500"
};

export default function OverviewDashboard() {
  const highlightedSection = useHashScroll();
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activitiesList, setActivitiesList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getDashboardOverview();
        setData(res);
      } catch (error) {
        console.error("Failed to fetch dashboard overview:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on("new-activity", (newActivity: any) => {
        setActivitiesList((prev) => [
          {
            icon: newActivity.type === 'upload_photo' || newActivity.type === 'upload' ? Upload : (newActivity.type === 'message' ? MessageSquare : Activity),
            text: `${newActivity.userName || 'Someone'} ${newActivity.description} in ${newActivity.projectName || 'a project'}`,
            time: "Just now",
            color: newActivity.type === 'upload_photo' ? "text-sky-500" : (newActivity.type === 'message' ? "text-sky-500" : "text-[hsl(24_95%_53%)]")
          },
          ...prev.slice(0, 14)
        ]);
      });

      return () => {
        socket.off('new-activity');
      };
    }
  }, [socket, isConnected]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Activity className="h-8 w-8 animate-spin text-[hsl(24_95%_53%)]" />
          <p className={cn("text-sm font-medium", mutedTextClass)}>Loading real-time analytics...</p>
        </div>
      </div>
    );
  }

  const dashboardStats = data?.stats || {};
  
  const metricsList = [
    {
      title: "Active Companies",
      value: String(dashboardStats.activeCompanies || 0),
      change: "+12%", 
      changeType: "up" as const,
      icon: Building2,
      sparkline: [12, 19, 28, 38, 52, 65, 78, dashboardStats.activeCompanies || 0],
    },
    {
      title: "Active Projects",
      value: String(dashboardStats.activeProjects || 0),
      change: "+8%",
      changeType: "up" as const,
      icon: FolderKanban,
      sparkline: [28, 45, 72, 110, 148, 190, 220, dashboardStats.activeProjects || 0],
    },
    {
      title: "Total Users",
      value: String(dashboardStats.totalUsers || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      change: "+156",
      changeType: "up" as const,
      icon: Users,
      sparkline: [180, 340, 560, 820, 1100, 1480, 1750, dashboardStats.totalUsers || 0],
    },
    {
      title: "Daily Active Users",
      value: String(dashboardStats.dailyActiveUsers || 0),
      change: "+5.2%",
      changeType: "up" as const,
      icon: Activity,
      sparkline: [620, 680, 710, 760, 790, 820, 835, dashboardStats.dailyActiveUsers || 0],
    },
    {
      title: "Tasks Completed",
      value: String(dashboardStats.tasksCompletedToday || 0),
      change: "Today",
      changeType: "neutral" as const,
      icon: CheckCircle,
      sparkline: [280, 310, 295, 330, 315, 340, 325, dashboardStats.tasksCompletedToday || 0],
    },
    {
      title: "Messages Sent",
      value: String(dashboardStats.messagesSentToday || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      change: "+18%",
      changeType: "up" as const,
      icon: MessageSquare,
      sparkline: [3200, 3800, 4100, 4500, 4200, 4800, 5100, dashboardStats.messagesSentToday || 0],
    },
  ];

  const getHighlightedCardClass = (sectionId: string) =>
    cn(
      cardClass,
      "transition-all duration-500",
      highlightedSection === sectionId &&
        "animate-pulse ring-2 ring-[hsl(24_95%_53%/0.45)] ring-offset-2 ring-offset-[hsl(38_33%_95%)] shadow-[0_0_0_4px_hsl(24_95%_53%/0.10)] dark:ring-offset-[hsl(30_10%_10%)]",
    );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className={cn("text-xl font-bold", strongTextClass)}>Dashboard Overview</h1>
        <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
          Real-time platform health & analytics
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metricsList.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <section id="platform-growth" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("platform-growth")}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                    Platform Growth
                  </h3>
                  <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
                    Companies, projects & users over time
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[hsl(24_95%_53%)]" />
                    Companies
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Projects
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Users
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data?.growth || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overview-companies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25,95%,53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(25,95%,53%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="overview-projects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  <Area type="monotone" dataKey="users" stroke="hsl(160,84%,39%)" strokeWidth={1.5} fill="none" />
                  <Area type="monotone" dataKey="projects" stroke="hsl(217,91%,60%)" strokeWidth={1.5} fill="url(#overview-projects)" />
                  <Area type="monotone" dataKey="companies" stroke="hsl(25,95%,53%)" strokeWidth={2} fill="url(#overview-companies)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section id="project-activity" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("project-activity")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Project Activity
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Tasks completed vs created (last 14 days)
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  { label: "Tasks Completed", value: String(data?.stats.tasksCompletedToday || 0), sub: "Today" },
                  { label: "RFIs Pending", value: String(data?.stats.rfisPending || 0), sub: "Requires attention" },
                  { label: "Photos Today", value: String(data?.stats.drawingsUploadedToday || 0), sub: "Last 24h" },
                  { label: "Total Files", value: String(data?.comms.filesBreakdown.reduce((acc: number, f: any) => acc + f.count, 0) || 0), sub: "Across all projects" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2.5 dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("text-lg font-bold", strongTextClass)}>{metric.value}</div>
                    <div className={cn("text-[10px] font-medium uppercase tracking-wide", mutedTextClass)}>
                      {metric.label}
                    </div>
                    <div className="text-[10px] font-medium text-[hsl(24_95%_53%)]">{metric.sub}</div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.activity || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  <Bar dataKey="completed" fill="hsl(25,95%,53%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="created" fill="rgba(249,116,22,0.3)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className={cardClass}>
            <h3 className={cn("mb-4 text-sm font-semibold", strongTextClass)}>
              Most Active Projects
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)]">
                    <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Project</th>
                    <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Company</th>
                    <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Risk</th>
                    <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Activity</th>
                    <th className={cn("py-2 text-right font-medium uppercase tracking-wide", mutedTextClass)}>Tasks</th>
                    <th className={cn("py-2 text-right font-medium uppercase tracking-wide", mutedTextClass)}>Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topProjects || []).map((project: any) => (
                    <tr
                      key={project.name}
                      className="border-b border-[hsl(35_15%_85%/0.5)] transition-colors duration-100 hover:bg-[hsl(37_18%_91%/0.4)] last:border-0 dark:border-[hsl(30_8%_22%/0.5)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                      <td className={cn("py-2.5 font-medium", strongTextClass)}>{project.name}</td>
                      <td className={cn("py-2.5", mutedTextClass)}>{project.company}</td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", riskColors[project.risk || 'green'])} />
                          <span className={mutedTextClass}>{riskLabels[project.risk || 'green']}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <SummaryPill className={activityBadge[project.activity > 100 ? "High" : (project.activity > 50 ? "Medium" : "Low")]}>
                          {project.activity > 100 ? "High" : (project.activity > 50 ? "Medium" : "Low")}
                        </SummaryPill>
                      </td>
                      <td className={cn("py-2.5 text-right font-medium", strongTextClass)}>{project.tasks}</td>
                      <td className={cn("py-2.5 text-right font-medium", strongTextClass)}>
                        {project.messages.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(!data?.topProjects || data.topProjects.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center opacity-50">No active projects found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <section id="communication" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("communication")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Communication Analytics
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Messages & file sharing activity
              </p>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { value: data?.comms.messagesToday.toLocaleString() || "0", label: "Messages Today" },
                  { value: ((data?.comms.messagesToday || 0) / (data?.stats.activeProjects || 1)).toFixed(1), label: "Msgs / Project" },
                  { value: ((data?.comms.messagesToday || 0) / (data?.stats.totalUsers || 1)).toFixed(1), label: "Msgs / User" },
                ].map((item) => (
                  <div key={item.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2.5 dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("text-lg font-bold", strongTextClass)}>{item.value}</div>
                    <div className={cn("text-[10px] font-medium uppercase", mutedTextClass)}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data?.comms.messagesTrend || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  <Bar dataKey="messages" fill="hsl(25,95%,53%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                <div className={cn("text-xs font-medium uppercase tracking-wide", mutedTextClass)}>
                  Files Shared
                </div>
                {(data?.comms.filesBreakdown || []).map((file: any) => (
                  <div key={file.type} className="flex items-center gap-3">
                    <span className={cn("w-16 text-xs font-medium", strongTextClass)}>{file.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                      <div className="h-full rounded-full bg-[hsl(24_95%_53%)]" style={{ width: `${(file.count / (data?.comms.filesBreakdown.reduce((acc: number, f: any) => acc + f.count, 0) || 1)) * 100}%` }} />
                    </div>
                    <span className={cn("w-12 text-right text-xs", mutedTextClass)}>
                      {file.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="project-health" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("project-health")}>
              <div className="mb-4 flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-[hsl(24_95%_53%)]" />
                <div>
                  <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                    Project Health
                  </h3>
                  <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
                    Completion progress, delays, RFIs, drawing waits, and site issues
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)]">
                      <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Project</th>
                      <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Status</th>
                      <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Completion</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Delayed</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>RFIs</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Drawings</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.projectHealth || []).map((project: any) => (
                      <tr
                        key={project.name}
                        className="border-b border-[hsl(35_15%_85%/0.5)] transition-colors duration-100 hover:bg-[hsl(37_18%_91%/0.4)] last:border-0 dark:border-[hsl(30_8%_22%/0.5)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                        <td className="py-2.5">
                          <div className={cn("font-medium", strongTextClass)}>{project.name}</div>
                          <div className={cn("mt-0.5 text-[11px]", mutedTextClass)}>{project.company}</div>
                        </td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", projectHealthStatus[project.status as keyof typeof projectHealthStatus]?.dot || "bg-gray-400")} />
                            <span className={mutedTextClass}>{projectHealthStatus[project.status as keyof typeof projectHealthStatus]?.label || "Unknown"}</span>
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                              <div
                                className={cn("h-full rounded-full", projectHealthStatus[project.status as keyof typeof projectHealthStatus]?.progress || "bg-gray-400")}
                                style={{ width: `${project.completion}%` }}
                              />
                            </div>
                            <span className={mutedTextClass}>{project.completion}%</span>
                          </div>
                        </td>
                        <td className={cn("py-2.5 text-center", project.delayed > 5 ? "font-semibold text-red-600 dark:text-red-400" : mutedTextClass)}>
                          {project.delayed}
                        </td>
                        <td className={cn("py-2.5 text-center", project.rfisPending > 5 ? "font-semibold text-amber-600 dark:text-amber-400" : mutedTextClass)}>
                          {project.rfisPending}
                        </td>
                        <td className={cn("py-2.5 text-center", mutedTextClass)}>{project.drawingsAwaiting}</td>
                        <td className={cn("py-2.5 text-center", project.siteIssues > 2 ? "font-semibold text-red-600 dark:text-red-400" : mutedTextClass)}>
                          {project.siteIssues}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="company-usage" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("company-usage")}>
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[hsl(24_95%_53%)]" />
                <div>
                  <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                    Company Usage
                  </h3>
                  <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
                    The most active companies by projects, users, messages, and tasks
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)]">
                      <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>#</th>
                      <th className={cn("py-2 text-left font-medium uppercase tracking-wide", mutedTextClass)}>Company</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Projects</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Users</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Messages</th>
                      <th className={cn("py-2 text-center font-medium uppercase tracking-wide", mutedTextClass)}>Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.companyUsage || []).map((company: any, index: number) => (
                      <tr
                        key={company.name}
                        className="border-b border-[hsl(35_15%_85%/0.5)] transition-colors duration-100 hover:bg-[hsl(37_18%_91%/0.4)] last:border-0 dark:border-[hsl(30_8%_22%/0.5)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                        <td className={cn("py-2.5 font-medium", mutedTextClass)}>{index + 1}</td>
                        <td className={cn("py-2.5 font-medium", strongTextClass)}>{company.name}</td>
                        <td className={cn("py-2.5 text-center", mutedTextClass)}>{company.projects}</td>
                        <td className={cn("py-2.5 text-center", mutedTextClass)}>{company.users}</td>
                        <td className={cn("py-2.5 text-center", mutedTextClass)}>{company.messages?.toLocaleString() || "0"}</td>
                        <td className={cn("py-2.5 text-center", mutedTextClass)}>{company.tasks?.toLocaleString() || "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <div className="rounded border border-[hsl(30_8%_20%)] bg-[hsl(30_10%_12%)] p-5 text-[hsl(38_20%_85%)] dark:border-[hsl(30_8%_16%)] dark:bg-[hsl(30_10%_8%)]">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[hsl(24_95%_53%)]" />
              <h3 className="text-sm font-semibold">Communication Shift Index</h3>
            </div>
            <p className="mb-4 text-xs text-[hsl(38_20%_85%/0.6)]">
              Teams moving from WhatsApp to Apexis
            </p>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium text-[hsl(38_20%_85%/0.8)]">WhatsApp</span>
                  <span className="font-bold text-[hsl(38_20%_85%/0.5)]">20%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[hsl(30_8%_18%)]">
                  <div className="h-full w-[20%] rounded-full bg-emerald-500/30" />
                </div>
              </div>
              <Activity className="h-4 w-4 shrink-0 text-[hsl(24_95%_53%)]" />
              <div className="flex-1">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium text-[hsl(24_95%_53%)]">Apexis</span>
                  <span className="font-bold text-[hsl(24_95%_53%)]">80%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[hsl(30_8%_18%)]">
                  <div className="h-full w-[80%] rounded-full bg-[hsl(24_95%_53%)]" />
                </div>
              </div>
            </div>

            <div className="rounded border border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.1)] p-3">
              <p className="text-center text-xs font-medium text-[hsl(24_95%_53%)]">
                🔥 80% of team communication has shifted to Apexis
              </p>
            </div>
          </div>

          <section id="live-activity" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("live-activity")}>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                  Live Activity Feed
                </h3>
              </div>
              <div className="max-h-[400px] space-y-0 overflow-y-auto">
                {(data?.feed || []).map((activity: any, index: number) => {
                  const Icon = activityIconMap[activity.type] || activityIconMap.default;
                  const color = activityColorMap[activity.type] || activityColorMap.default;
                  return (
                  <div
                    key={`${activity.text}-${index}`}
                    className="flex items-start gap-3 border-b border-[hsl(35_15%_85%/0.5)] py-2.5 last:border-0 dark:border-[hsl(30_8%_22%/0.5)]">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs leading-relaxed", strongTextClass)}>{activity.text}</p>
                      <p className={cn("mt-0.5 text-[10px]", mutedTextClass)}>{new Date(activity.time).toLocaleTimeString()}</p>
                    </div>
                  </div>
                )})}
                {(!data?.feed || data.feed.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 opacity-50">
                    <Activity className="h-8 w-8 animate-pulse text-[hsl(24_95%_53%)]" />
                    <p className="mt-2 text-xs">Waiting for live activities...</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="alerts" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("alerts")}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={cn("text-sm font-semibold", strongTextClass)}>Alerts</h3>
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {(data?.alerts || []).length}
                </span>
              </div>
              <div className="space-y-2">
                {(data?.alerts || []).map((alert: any, index: number) => {
                  const Icon = alert.severity === 'critical' ? AlertTriangle : (alert.severity === 'warning' ? AlertCircle : Clock);
                  return (
                  <div
                    key={`${alert.text}-${index}`}
                    className={cn(
                      "flex items-start gap-3 rounded border p-3",
                      severityStyles[alert.severity as keyof typeof severityStyles] || severityStyles.info,
                    )}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{alert.text}</p>
                      <p className="mt-0.5 text-[10px] opacity-70">{new Date(alert.time).toLocaleTimeString()}</p>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </section>

          <section id="intelligence" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("intelligence")}>
              <div className="mb-4 flex items-center gap-2">
                <Brain className="h-4 w-4 text-[hsl(24_95%_53%)]" />
                <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                  Construction Intelligence
                </h3>
              </div>
              <div className="space-y-2">
                {(data?.insights || []).map((insight: any, index: number) => {
                  const Icon = insight.icon === 'TrendingUp' ? TrendingUp : (insight.icon === 'TrendingDown' ? TrendingDown : Lightbulb);
                  return (
                  <div
                    key={`${insight.text}-${index}`}
                    className="rounded border border-[hsl(24_95%_53%/0.15)] bg-[hsl(24_95%_53%/0.06)] p-3">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(24_95%_53%)]" />
                      <p className={cn("text-xs leading-relaxed", strongTextClass)}>
                        {insight.text}
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </section>

          <section id="feature-usage" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("feature-usage")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Feature Usage
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Adoption rates across features
              </p>
              <div className="space-y-3">
                {(data?.features || []).map((feature: any) => (
                  <div key={feature.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={cn("font-medium", strongTextClass)}>{feature.name}</span>
                      <span className="font-bold text-[hsl(24_95%_53%)]">{feature.usage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                      <div
                        className="h-full rounded-full bg-[hsl(24_95%_53%)] transition-all duration-500"
                        style={{ width: `${feature.usage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="system-health" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("system-health")}>
              <div className="mb-4 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-[hsl(24_95%_53%)]" />
                <div>
                  <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                    System Health
                  </h3>
                  <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
                    Core uptime, performance, and storage indicators
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Server Uptime", value: data?.stats.systemHealth?.uptime || "99.9%", status: "good" },
                  { label: "API Response Time", value: data?.stats.systemHealth?.responseTime || "150ms", status: "good" },
                  { label: "File Storage Used", value: data?.stats.systemHealth?.storageUsed || "0 GB", status: "warning" },
                  { label: "Failed Uploads", value: data?.stats.systemHealth?.failedUploads || "0.0%", status: "good" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="flex items-start gap-3 rounded bg-[hsl(37_18%_91%/0.55)] p-3 dark:bg-[hsl(30_6%_18%)]">
                    {metric.status === "good" ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className={cn("text-lg font-bold", strongTextClass)}>{metric.value}</p>
                      <p className={cn("text-[10px] font-medium uppercase tracking-[0.14em]", mutedTextClass)}>
                        {metric.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="user-behavior" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("user-behavior")}>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-[hsl(24_95%_53%)]" />
                <div>
                  <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                    User Behavior
                  </h3>
                  <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
                    Session patterns and the most-used surfaces across the platform
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Avg Session Time", value: data?.stats.userBehavior?.avgSessionTime || "12 min" },
                  { label: "Sessions Per Day", value: data?.stats.userBehavior?.sessionsPerDay || "3.5" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded bg-[hsl(37_18%_91%/0.55)] p-3 dark:bg-[hsl(30_6%_18%)]">
                    <p className={cn("text-2xl font-bold", strongTextClass)}>{metric.value}</p>
                    <p className={cn("text-[10px] font-medium uppercase tracking-[0.14em]", mutedTextClass)}>
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className={cn("text-xs font-medium uppercase tracking-[0.14em]", mutedTextClass)}>
                  Most Used Screens
                </p>
                {(data?.screenUsage || [
                  { screen: "Chat", sessions: 42 },
                  { screen: "Tasks", sessions: 28 },
                  { screen: "Drawings", sessions: 18 },
                  { screen: "RFIs", sessions: 8 },
                  { screen: "Dashboard", sessions: 4 },
                ]).map((screen: any) => (
                  <div key={screen.screen} className="flex items-center gap-2">
                    <span className={cn("w-20 text-xs font-medium", strongTextClass)}>{screen.screen}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                      <div
                        className="h-full rounded bg-[hsl(24_95%_53%)]"
                        style={{ width: `${screen.sessions}%` }}
                      />
                    </div>
                    <span className={cn("w-10 text-right text-xs", mutedTextClass)}>{screen.sessions}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="revenue" className={scrollSectionClass}>
            <div className={getHighlightedCardClass("revenue")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Revenue Analytics
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Subscription metrics & MRR growth
              </p>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {[
                  { label: "Free Users", value: data?.revenue?.freeUsers || 0 },
                  { label: "Paid Users", value: data?.revenue?.paidUsers || 0 },
                  { label: "Trial Users", value: "200" },
                  { label: "MRR", value: `₹${(data?.revenue?.mrr || 0).toLocaleString()}` },
                  { label: "Conversion", value: `${data?.revenue?.conversionRate || 0}%` },
                  { label: "Churn Rate", value: "3.2%" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2 dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("text-sm font-bold", strongTextClass)}>{metric.value}</div>
                    <div className={cn("text-[10px] font-medium uppercase tracking-wide", mutedTextClass)}>
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data?.revenueTrend || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overview-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160,84%,39%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(160,84%,39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: any) => `₹${(Number(value) / 1000).toFixed(0)}k`}
                  />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "MRR"]}
                    />
                  <Area type="monotone" dataKey="mrr" stroke="hsl(160,84%,39%)" strokeWidth={2} fill="url(#overview-revenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
