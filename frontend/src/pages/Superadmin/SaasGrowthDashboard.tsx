"use client";

import { type ReactNode, useState } from "react";
import {
  Users,
  Building2,
  FolderKanban,
  UserCheck,
  CreditCard,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Upload,
  Camera,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  UserPlus,
  Star,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

type DateFilter = "today" | "7days" | "30days" | "12months";

const executiveMetrics = [
  { title: "Total Users", value: "4,820", change: "+12.4%", changeType: "up", icon: Users },
  { title: "Active Companies", value: "184", change: "+8.2%", changeType: "up", icon: Building2 },
  { title: "Active Projects", value: "612", change: "+15.7%", changeType: "up", icon: FolderKanban },
  { title: "Freemium Users", value: "3,240", change: "+6.1%", changeType: "up", icon: UserCheck },
  { title: "Paid Subscribers", value: "1,580", change: "+22.3%", changeType: "up", icon: CreditCard },
  { title: "MRR", value: "₹4,12,800", change: "+18.5%", changeType: "up", icon: DollarSign },
  { title: "ARR", value: "₹49,53,600", change: "+18.5%", changeType: "up", icon: TrendingUp },
  { title: "Conversion Rate", value: "32.8%", change: "+3.2%", changeType: "up", icon: Star },
];

const userGrowthDaily = [
  { day: "Mon", users: 42 },
  { day: "Tue", users: 58 },
  { day: "Wed", users: 35 },
  { day: "Thu", users: 71 },
  { day: "Fri", users: 63 },
  { day: "Sat", users: 28 },
  { day: "Sun", users: 19 },
];

const userGrowthMonthly = [
  { month: "Sep", users: 320 },
  { month: "Oct", users: 580 },
  { month: "Nov", users: 890 },
  { month: "Dec", users: 1240 },
  { month: "Jan", users: 1820 },
  { month: "Feb", users: 2650 },
  { month: "Mar", users: 3410 },
  { month: "Apr", users: 4820 },
];

const funnelData = [
  { stage: "Signed Up", value: 4820, pct: 100 },
  { stage: "Started Trial", value: 3860, pct: 80.1 },
  { stage: "Actively Using", value: 2510, pct: 52.1 },
  { stage: "Converted to Paid", value: 1580, pct: 32.8 },
];

const revenueMonthly = [
  { month: "Sep", mrr: 84000, standard: 52000, professional: 32000 },
  { month: "Oct", mrr: 142000, standard: 88000, professional: 54000 },
  { month: "Nov", mrr: 198000, standard: 121000, professional: 77000 },
  { month: "Dec", mrr: 256000, standard: 156000, professional: 100000 },
  { month: "Jan", mrr: 312000, standard: 189000, professional: 123000 },
  { month: "Feb", mrr: 368000, standard: 220000, professional: 148000 },
  { month: "Mar", mrr: 412800, standard: 245000, professional: 167800 },
];

const planBreakdown = [
  { name: "Standard ₹199", value: 920, color: "hsl(25, 95%, 53%)" },
  { name: "Professional ₹299", value: 660, color: "#e98b06" },
];

const productUsageData = [
  { month: "Oct", projects: 120, drawings: 340, messages: 8200, releases: 85 },
  { month: "Nov", projects: 185, drawings: 520, messages: 14500, releases: 140 },
  { month: "Dec", projects: 280, drawings: 710, messages: 22300, releases: 210 },
  { month: "Jan", projects: 390, drawings: 950, messages: 34800, releases: 295 },
  { month: "Feb", projects: 490, drawings: 1180, messages: 48200, releases: 380 },
  { month: "Mar", projects: 612, drawings: 1420, messages: 62400, releases: 470 },
];

const productUsageMetrics = [
  { label: "Projects Created", value: "612" },
  { label: "Drawings Uploaded", value: "1,420" },
  { label: "Drawing Releases", value: "470" },
  { label: "Chat Messages", value: "62,400" },
  { label: "Team Members Added", value: "3,180" },
  { label: "Client Members Added", value: "1,640" },
];

const companyActivity = [
  { name: "Skyline Constructions", projects: 18, team: 42, drawings: 320, messages: 8400, lastActive: "2 min ago", plan: "₹299" },
  { name: "Metro Builders", projects: 14, team: 35, drawings: 240, messages: 6200, lastActive: "5 min ago", plan: "₹299" },
  { name: "ARC Architects", projects: 11, team: 28, drawings: 185, messages: 4800, lastActive: "12 min ago", plan: "₹199" },
  { name: "Greenfield Homes", projects: 8, team: 22, drawings: 140, messages: 3600, lastActive: "1 hr ago", plan: "₹199" },
  { name: "Prime Developers", projects: 6, team: 18, drawings: 95, messages: 2100, lastActive: "3 hr ago", plan: "Free" },
  { name: "Urban Spaces", projects: 5, team: 15, drawings: 82, messages: 1800, lastActive: "5 hr ago", plan: "Free" },
];

const conversionOpportunities = [
  { name: "Prime Developers", email: "info@primedev.com", phone: "+91 9876543210", projects: 6, drawings: 95, teamSize: 18, daysLeft: 12, activity: "High" },
  { name: "Urban Spaces", email: "hello@urbanspaces.in", phone: "+91 9123456789", projects: 5, drawings: 82, teamSize: 15, daysLeft: 18, activity: "High" },
  { name: "Coastal Builders", email: "ops@coastal.com", phone: "+91 8765432190", projects: 3, drawings: 48, teamSize: 10, daysLeft: 24, activity: "Medium" },
  { name: "Apex Infra", email: "admin@apexinfra.in", phone: "+91 7654321098", projects: 4, drawings: 62, teamSize: 12, daysLeft: 8, activity: "High" },
];

const activityFeed = [
  { icon: UserPlus, text: "Coastal Builders signed up for Apexis", time: "1 min ago", color: "text-emerald-600 dark:text-emerald-400" },
  { icon: FolderKanban, text: "New project 'Marina Heights' created by Metro Builders", time: "3 min ago", color: "text-[hsl(24_95%_53%)]" },
  { icon: Upload, text: "32 drawings uploaded – Skyline Phase 3", time: "8 min ago", color: "text-sky-500" },
  { icon: CreditCard, text: "ARC Architects upgraded to Professional ₹299", time: "15 min ago", color: "text-emerald-600 dark:text-emerald-400" },
  { icon: Camera, text: "Site progress photos posted – Greenfield Homes", time: "22 min ago", color: "text-[hsl(24_95%_53%)]" },
  { icon: CheckCircle, text: "48 tasks completed today across 12 projects", time: "30 min ago", color: "text-emerald-600 dark:text-emerald-400" },
  { icon: MessageSquare, text: "Team discussion started on structural specs – Prime Dev", time: "45 min ago", color: "text-sky-500" },
  { icon: AlertCircle, text: "RFI raised for waterproofing details – Coastal Builders", time: "1 hr ago", color: "text-amber-500" },
];

const pageShellClass =
  "space-y-6 p-4 md:p-6";
const cardClass =
  "rounded border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]";
const mutedTextClass =
  "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";
const strongTextClass =
  "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";
const tableHeadClass =
  "border-b border-[hsl(35_15%_85%)] px-4 py-3 text-left text-xs font-semibold dark:border-[hsl(30_8%_22%)]";
const tableCellClass =
  "border-b border-[hsl(35_15%_85%/0.6)] px-4 py-3 text-xs dark:border-[hsl(30_8%_22%/0.6)]";

const chartGridStroke = "hsl(214,20%,90%)";
const chartTickColor = "hsl(215,10%,45%)";

const ChangeIndicator = ({
  change,
  type,
}: {
  change: string;
  type: string;
}) => {
  const colorClass =
    type === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : type === "down"
        ? "text-red-600 dark:text-red-400"
        : mutedTextClass;
  const Icon = type === "up" ? ArrowUpRight : type === "down" ? ArrowDownRight : Minus;

  return (
    <span className={cn("mt-1 flex items-center gap-0.5 text-xs font-medium", colorClass)}>
      <Icon className="h-3 w-3" /> {change}
    </span>
  );
};

const Pill = ({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) => (
  <span className={cn("inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", className)}>
    {children}
  </span>
);

export default function SaasGrowthDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");

  const filters: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7days", label: "7 Days" },
    { key: "30days", label: "30 Days" },
    { key: "12months", label: "12 Months" },
  ];

  return (
    <div className={pageShellClass}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-xl font-bold", strongTextClass)}>SaaS Growth Dashboard</h1>
          <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
            Executive overview — platform health & growth
          </p>
        </div>

        <div className={cn("inline-flex w-full flex-wrap items-center gap-1 rounded border p-0.5 lg:w-auto", cardClass)}>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                dateFilter === filter.key
                  ? "bg-[hsl(24_95%_53%)] text-white"
                  : `${mutedTextClass} hover:text-[hsl(30_10%_15%)] dark:hover:text-[hsl(38_20%_90%)]`,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {executiveMetrics.map((metric) => (
          <div key={metric.title} className={cn(cardClass, "p-4")}>
            <div className="mb-2 flex items-center justify-between">
              <span className={cn("text-xs font-medium uppercase tracking-wide", mutedTextClass)}>
                {metric.title}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[hsl(24_95%_53%/0.1)]">
                <metric.icon className="h-3.5 w-3.5 text-[hsl(24_95%_53%)]" />
              </div>
            </div>
            <div className={cn("text-2xl font-bold", strongTextClass)}>{metric.value}</div>
            <ChangeIndicator change={metric.change} type={metric.changeType} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className={cn(cardClass, "p-5")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>New Users Per Day</h3>
              <p className={cn("mb-3 text-xs", mutedTextClass)}>This week&apos;s daily signups</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={userGrowthDaily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  <Bar dataKey="users" fill="hsl(25,95%,53%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={cn(cardClass, "p-5")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Total User Growth</h3>
              <p className={cn("mb-3 text-xs", mutedTextClass)}>Cumulative users over time</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={userGrowthMonthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25,95%,53%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(25,95%,53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  <Area type="monotone" dataKey="users" stroke="hsl(25,95%,53%)" strokeWidth={2} fill="url(#ugGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Freemium Funnel</h3>
            <p className={cn("mb-4 text-xs", mutedTextClass)}>Conversion from signup to paid</p>
            <div className="space-y-3">
              {funnelData.map((step, index) => (
                <div key={step.stage}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("text-xs font-medium", strongTextClass)}>
                      Step {index + 1}: {step.stage}
                    </span>
                    <span className={cn("text-xs", mutedTextClass)}>
                      {step.value.toLocaleString()} ({step.pct}%)
                    </span>
                  </div>
                  <div className="relative h-7 overflow-hidden rounded-sm bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                    <div
                      className="h-full rounded-sm transition-all duration-700"
                      style={{
                        width: `${step.pct}%`,
                        background: `linear-gradient(90deg, hsl(25,95%,53%), hsl(25,95%,${53 + index * 6}%))`,
                        opacity: 1 - index * 0.15,
                      }}
                    />
                    {index < funnelData.length - 1 && (
                      <span className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold", mutedTextClass)}>
                        → {((funnelData[index + 1].value / step.value) * 100).toFixed(1)}% conversion
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <div className={cn(cardClass, "p-5 2xl:col-span-2")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Revenue Growth</h3>
              <p className={cn("mb-3 text-xs", mutedTextClass)}>MRR breakdown by plan</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueMonthly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25,95%,53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(25,95%,53%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e98b06" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#e98b06" stopOpacity={0} />
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
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
                  />
                  <Area type="monotone" dataKey="standard" name="Standard ₹199" stroke="hsl(25,95%,53%)" strokeWidth={2} fill="url(#stdGrad)" stackId="1" />
                  <Area type="monotone" dataKey="professional" name="Professional ₹299" stroke="#e98b06" strokeWidth={2} fill="url(#proGrad)" stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={cn(cardClass, "flex flex-col p-5")}>
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Plan Breakdown</h3>
              <p className={cn("mb-2 text-xs", mutedTextClass)}>Paid subscribers by plan</p>
              <div className="flex flex-1 items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={planBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                      {planBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={index === 0 ? "hsl(25,95%,53%)" : "#e98b06"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {planBreakdown.map((plan) => (
                  <div key={plan.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: plan.color }} />
                      <span className={mutedTextClass}>{plan.name}</span>
                    </div>
                    <span className={cn("font-semibold", strongTextClass)}>{plan.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-[hsl(35_15%_85%)] pt-3 dark:border-[hsl(30_8%_22%)]">
                <div className={cn("text-xs", mutedTextClass)}>ARPU</div>
                <div className={cn("text-lg font-bold", strongTextClass)}>₹261</div>
              </div>
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Product Usage Analytics</h3>
            <p className={cn("mb-3 text-xs", mutedTextClass)}>How companies are using Apexis</p>
            <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-6">
              {productUsageMetrics.map((metric) => (
                <div key={metric.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2.5 dark:bg-[hsl(30_6%_18%)]">
                  <div className={cn("text-sm font-bold", strongTextClass)}>{metric.value}</div>
                  <div className={cn("text-[10px] font-medium uppercase tracking-wide", mutedTextClass)}>
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={productUsageData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                <Line type="monotone" dataKey="projects" name="Projects" stroke="hsl(25,95%,53%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="drawings" name="Drawings" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="releases" name="Releases" stroke="hsl(160,84%,39%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className={cn(cardClass, "overflow-hidden")}>
            <div className="px-5 py-5">
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Most Active Companies</h3>
              <p className={cn("text-xs", mutedTextClass)}>Top companies by platform usage</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    <th className={tableHeadClass}>Company</th>
                    <th className={tableHeadClass}>Projects</th>
                    <th className={tableHeadClass}>Team</th>
                    <th className={tableHeadClass}>Drawings</th>
                    <th className={tableHeadClass}>Messages</th>
                    <th className={tableHeadClass}>Last Active</th>
                    <th className={tableHeadClass}>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {companyActivity.map((company) => (
                    <tr key={company.name}>
                      <td className={cn(tableCellClass, "font-medium", strongTextClass)}>{company.name}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.projects}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.team}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.drawings}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.messages.toLocaleString()}</td>
                      <td className={cn(tableCellClass, mutedTextClass)}>{company.lastActive}</td>
                      <td className={tableCellClass}>
                        {company.plan === "Free" ? (
                          <Pill className="border-[hsl(35_15%_85%)] bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_6%_18%)] dark:text-[hsl(38_10%_55%)]">
                            {company.plan}
                          </Pill>
                        ) : (
                          <Pill className="border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)]">
                            {company.plan}
                          </Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cn(cardClass, "overflow-hidden")}>
            <div className="px-5 py-5">
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>🔥 Conversion Opportunities</h3>
              <p className={cn("text-xs", mutedTextClass)}>High-usage freemium companies ready for upgrade</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    <th className={tableHeadClass}>Company</th>
                    <th className={tableHeadClass}>Email</th>
                    <th className={tableHeadClass}>Phone</th>
                    <th className={tableHeadClass}>Projects</th>
                    <th className={tableHeadClass}>Drawings</th>
                    <th className={tableHeadClass}>Team</th>
                    <th className={tableHeadClass}>Days Left</th>
                    <th className={tableHeadClass}>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionOpportunities.map((company) => (
                    <tr key={company.name}>
                      <td className={cn(tableCellClass, "font-medium", strongTextClass)}>{company.name}</td>
                      <td className={cn(tableCellClass, mutedTextClass)}>{company.email}</td>
                      <td className={cn(tableCellClass, mutedTextClass)}>{company.phone}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.projects}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.drawings}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.teamSize}</td>
                      <td className={tableCellClass}>
                        <Pill
                          className={
                            company.daysLeft <= 10
                              ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                              : "border-[hsl(35_15%_85%)] bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_6%_18%)] dark:text-[hsl(38_10%_55%)]"
                          }
                        >
                          {company.daysLeft} days
                        </Pill>
                      </td>
                      <td className={tableCellClass}>
                        <Pill
                          className={
                            company.activity === "High"
                              ? "border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)]"
                              : "border-[hsl(35_15%_85%)] bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_6%_18%)] dark:text-[hsl(38_10%_55%)]"
                          }
                        >
                          {company.activity}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-3 text-sm font-semibold", strongTextClass)}>Revenue Snapshot</h3>
            <div className="space-y-3">
              {[
                { label: "MRR", value: "₹4,12,800" },
                { label: "ARR", value: "₹49,53,600" },
                { label: "ARPU", value: "₹261" },
                { label: "MoM Growth", value: "+12.2%" },
              ].map((metric) => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span className={cn("text-xs", mutedTextClass)}>{metric.label}</span>
                  <span className={cn("text-sm font-bold", strongTextClass)}>{metric.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <h3 className={cn("text-sm font-semibold", strongTextClass)}>Platform Activity</h3>
            </div>
            <div className="max-h-[420px] space-y-0 overflow-y-auto">
              {activityFeed.map((activity, index) => (
                <div key={`${activity.text}-${index}`} className="flex items-start gap-3 border-b border-[hsl(35_15%_85%/0.5)] py-2.5 last:border-0 dark:border-[hsl(30_8%_22%/0.5)]">
                  <activity.icon className={cn("mt-0.5 h-4 w-4 shrink-0", activity.color)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs leading-relaxed", strongTextClass)}>{activity.text}</p>
                    <p className={cn("mt-0.5 text-[10px]", mutedTextClass)}>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-3 text-sm font-semibold", strongTextClass)}>Conversion Metrics</h3>
            <div className="space-y-3">
              {[
                { label: "Free → Paid Rate", value: "32.8%", color: "bg-emerald-500" },
                { label: "Trial Completion Rate", value: "80.1%", color: "bg-[hsl(24_95%_53%)]" },
                { label: "Churn Rate", value: "2.4%", color: "bg-red-500" },
                { label: "Expansion Revenue", value: "+8.6%", color: "bg-sky-500" },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("text-xs", mutedTextClass)}>{metric.label}</span>
                    <span className={cn("text-xs font-bold", strongTextClass)}>{metric.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("h-full rounded-full", metric.color)} style={{ width: metric.value.replace("%", "") + "%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
