"use client";

import { type ReactNode, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  FolderKanban,
  HardDrive,
  MessageSquare,
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
import { cn } from "@/lib/utils";

const metrics = [
  {
    title: "Active Companies",
    value: "84",
    change: "+12% this month",
    changeType: "up" as const,
    icon: Building2,
    sparkline: [12, 19, 28, 38, 52, 65, 78, 84],
  },
  {
    title: "Active Projects",
    value: "236",
    change: "+8% this week",
    changeType: "up" as const,
    icon: FolderKanban,
    sparkline: [28, 45, 72, 110, 148, 190, 220, 236],
  },
  {
    title: "Total Users",
    value: "1,920",
    change: "+156 this month",
    changeType: "up" as const,
    icon: Users,
    sparkline: [180, 340, 560, 820, 1100, 1480, 1750, 1920],
  },
  {
    title: "Daily Active Users",
    value: "847",
    change: "+5.2% today",
    changeType: "up" as const,
    icon: Activity,
    sparkline: [620, 680, 710, 760, 790, 820, 835, 847],
  },
  {
    title: "Tasks Completed",
    value: "342",
    change: "Today",
    changeType: "neutral" as const,
    icon: CheckCircle,
    sparkline: [280, 310, 295, 330, 315, 340, 325, 342],
  },
  {
    title: "Messages Sent",
    value: "5,430",
    change: "+18% vs yesterday",
    changeType: "up" as const,
    icon: MessageSquare,
    sparkline: [3200, 3800, 4100, 4500, 4200, 4800, 5100, 5430],
  },
];

const platformGrowthData = [
  { month: "Aug", companies: 12, projects: 28, users: 180 },
  { month: "Sep", companies: 19, projects: 45, users: 340 },
  { month: "Oct", companies: 28, projects: 72, users: 560 },
  { month: "Nov", companies: 38, projects: 110, users: 820 },
  { month: "Dec", companies: 52, projects: 148, users: 1100 },
  { month: "Jan", companies: 65, projects: 190, users: 1480 },
  { month: "Feb", companies: 78, projects: 220, users: 1750 },
  { month: "Mar", companies: 84, projects: 236, users: 1920 },
];

const projectActivityData = [
  { day: "Day 1", completed: 26, created: 18 },
  { day: "Day 2", completed: 31, created: 22 },
  { day: "Day 3", completed: 29, created: 20 },
  { day: "Day 4", completed: 36, created: 27 },
  { day: "Day 5", completed: 34, created: 24 },
  { day: "Day 6", completed: 39, created: 26 },
  { day: "Day 7", completed: 42, created: 29 },
  { day: "Day 8", completed: 37, created: 25 },
  { day: "Day 9", completed: 33, created: 23 },
  { day: "Day 10", completed: 41, created: 28 },
  { day: "Day 11", completed: 44, created: 30 },
  { day: "Day 12", completed: 38, created: 24 },
  { day: "Day 13", completed: 35, created: 22 },
  { day: "Day 14", completed: 40, created: 27 },
];

const activityMetrics = [
  { label: "Tasks Created", value: "1,248", sub: "this month" },
  { label: "Tasks Completed", value: "982", sub: "78.7% rate" },
  { label: "RFIs Raised", value: "147", sub: "32 pending" },
  { label: "Drawings Uploaded", value: "384", sub: "62 revisions" },
];

const messagesPerDay = [
  { day: "Mon", messages: 680 },
  { day: "Tue", messages: 820 },
  { day: "Wed", messages: 950 },
  { day: "Thu", messages: 1120 },
  { day: "Fri", messages: 890 },
  { day: "Sat", messages: 420 },
  { day: "Sun", messages: 350 },
];

const fileBreakdown = [
  { type: "Photos", count: 2430, pct: 63 },
  { type: "PDFs", count: 870, pct: 23 },
  { type: "Drawings", count: 410, pct: 11 },
  { type: "Videos", count: 120, pct: 3 },
];

const projects = [
  { name: "Skyline Towers", company: "ABC Developers", activity: "High", risk: "green", tasks: 142, messages: 890 },
  { name: "Palm Residency", company: "XYZ Constructions", activity: "Medium", risk: "yellow", tasks: 87, messages: 520 },
  { name: "Lakeview Villa", company: "Studio Architects", activity: "Low", risk: "red", tasks: 23, messages: 110 },
  { name: "Metro Hub Phase 2", company: "Metro Corp", activity: "High", risk: "green", tasks: 198, messages: 1240 },
  { name: "Green Valley Homes", company: "Greenfield Realty", activity: "Medium", risk: "green", tasks: 65, messages: 340 },
  { name: "Harbor Point", company: "Coastal Builders", activity: "Medium", risk: "yellow", tasks: 54, messages: 280 },
];

const features = [
  { name: "Chat", usage: 91 },
  { name: "Tasks", usage: 64 },
  { name: "Drawings", usage: 47 },
  { name: "RFIs", usage: 38 },
  { name: "Site Updates", usage: 33 },
];

const revenueData = [
  { month: "Sep", mrr: 8400 },
  { month: "Oct", mrr: 14200 },
  { month: "Nov", mrr: 22800 },
  { month: "Dec", mrr: 31500 },
  { month: "Jan", mrr: 42100 },
  { month: "Feb", mrr: 56800 },
  { month: "Mar", mrr: 68400 },
];

const revenueMetrics = [
  { label: "Free Users", value: "1,240" },
  { label: "Paid Users", value: "480" },
  { label: "Trial Users", value: "200" },
  { label: "MRR", value: "₹68,400" },
  { label: "Conversion", value: "25.0%" },
  { label: "Churn Rate", value: "3.2%" },
];

const liveActivities = [
  { icon: Upload, text: "Architect uploaded Drawing Revision 4 – Tower A", time: "2 min ago", color: "text-sky-500" },
  { icon: Camera, text: "Contractor posted site slab casting photos", time: "5 min ago", color: "text-[hsl(24_95%_53%)]" },
  { icon: CheckCircle, text: "Client approved layout drawing – Palm Residency", time: "12 min ago", color: "text-emerald-600 dark:text-emerald-400" },
  { icon: AlertCircle, text: "Site engineer raised RFI for staircase detail", time: "18 min ago", color: "text-amber-500" },
  { icon: MessageSquare, text: "Team discussion started on foundation specs", time: "25 min ago", color: "text-sky-500" },
  { icon: FileText, text: "New BOQ revision uploaded – Skyline Towers", time: "32 min ago", color: "text-[hsl(24_95%_53%)]" },
  { icon: CheckCircle, text: "Task 'Install plumbing Phase 2' marked done", time: "41 min ago", color: "text-emerald-600 dark:text-emerald-400" },
  { icon: Camera, text: "Daily progress photos uploaded – Metro Hub", time: "1 hr ago", color: "text-[hsl(24_95%_53%)]" },
];

const alerts = [
  { icon: AlertTriangle, text: "Lakeview Villa inactive for 10 days", severity: "critical", time: "2 hours ago" },
  { icon: Clock, text: "3 RFIs pending for over 5 days", severity: "warning", time: "4 hours ago" },
  { icon: HardDrive, text: "ABC Developers storage at 85% capacity", severity: "warning", time: "6 hours ago" },
  { icon: CreditCard, text: "XYZ Constructions trial expiring in 3 days", severity: "info", time: "1 day ago" },
];

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

const scrollSectionClass = "scroll-mt-24";

const metricChangeClass: Record<"up" | "down" | "neutral", string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: mutedTextClass,
};

function useHashScroll() {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;

      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);
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

export default function OverviewDashboard() {
  useHashScroll();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className={cn("text-xl font-bold", strongTextClass)}>Dashboard Overview</h1>
        <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
          Real-time platform health & analytics
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <section id="platform-growth" className={scrollSectionClass}>
            <div className={cardClass}>
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
                <AreaChart data={platformGrowthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
            <div className={cardClass}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Project Activity
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Tasks completed vs created (last 14 days)
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {activityMetrics.map((metric) => (
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
                <BarChart data={projectActivityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                  {projects.map((project) => (
                    <tr
                      key={project.name}
                      className="border-b border-[hsl(35_15%_85%/0.5)] transition-colors duration-100 hover:bg-[hsl(37_18%_91%/0.4)] last:border-0 dark:border-[hsl(30_8%_22%/0.5)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                      <td className={cn("py-2.5 font-medium", strongTextClass)}>{project.name}</td>
                      <td className={cn("py-2.5", mutedTextClass)}>{project.company}</td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", riskColors[project.risk])} />
                          <span className={mutedTextClass}>{riskLabels[project.risk]}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <SummaryPill className={activityBadge[project.activity]}>
                          {project.activity}
                        </SummaryPill>
                      </td>
                      <td className={cn("py-2.5 text-right font-medium", strongTextClass)}>{project.tasks}</td>
                      <td className={cn("py-2.5 text-right font-medium", strongTextClass)}>
                        {project.messages.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <section id="communication" className={scrollSectionClass}>
            <div className={cardClass}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Communication Analytics
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Messages & file sharing activity
              </p>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { value: "5,430", label: "Messages Today" },
                  { value: "64.7", label: "Msgs / Project" },
                  { value: "2.8", label: "Msgs / User" },
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
                <BarChart data={messagesPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                {fileBreakdown.map((file) => (
                  <div key={file.type} className="flex items-center gap-3">
                    <span className={cn("w-16 text-xs font-medium", strongTextClass)}>{file.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                      <div className="h-full rounded-full bg-[hsl(24_95%_53%)]" style={{ width: `${file.pct}%` }} />
                    </div>
                    <span className={cn("w-12 text-right text-xs", mutedTextClass)}>
                      {file.count.toLocaleString()}
                    </span>
                  </div>
                ))}
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
            <div className={cardClass}>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <h3 className={cn("text-sm font-semibold", strongTextClass)}>
                  Live Activity Feed
                </h3>
              </div>
              <div className="max-h-[400px] space-y-0 overflow-y-auto">
                {liveActivities.map((activity, index) => (
                  <div
                    key={`${activity.text}-${index}`}
                    className="flex items-start gap-3 border-b border-[hsl(35_15%_85%/0.5)] py-2.5 last:border-0 dark:border-[hsl(30_8%_22%/0.5)]">
                    <activity.icon className={cn("mt-0.5 h-4 w-4 shrink-0", activity.color)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs leading-relaxed", strongTextClass)}>{activity.text}</p>
                      <p className={cn("mt-0.5 text-[10px]", mutedTextClass)}>{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="alerts" className={scrollSectionClass}>
            <div className={cardClass}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={cn("text-sm font-semibold", strongTextClass)}>Alerts</h3>
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {alerts.length}
                </span>
              </div>
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div
                    key={`${alert.text}-${index}`}
                    className={cn(
                      "flex items-start gap-3 rounded border p-3",
                      severityStyles[alert.severity],
                    )}>
                    <alert.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{alert.text}</p>
                      <p className="mt-0.5 text-[10px] opacity-70">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="feature-usage" className={scrollSectionClass}>
            <div className={cardClass}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Feature Usage
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Adoption rates across features
              </p>
              <div className="space-y-3">
                {features.map((feature) => (
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

          <section id="revenue" className={scrollSectionClass}>
            <div className={cardClass}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>
                Revenue Analytics
              </h3>
              <p className={cn("mb-4 text-xs", mutedTextClass)}>
                Subscription metrics & MRR growth
              </p>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {revenueMetrics.map((metric) => (
                  <div key={metric.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2 dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("text-sm font-bold", strongTextClass)}>{metric.value}</div>
                    <div className={cn("text-[10px] font-medium uppercase tracking-wide", mutedTextClass)}>
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                    tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "MRR"]}
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
