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
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { useEffect } from "react";
import { getGrowthAnalytics } from "@/services/superadminService";

type DateFilter = "today" | "7days" | "30days" | "12months";

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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchGrowthData = async () => {
      try {
        const response = await getGrowthAnalytics();
        setData(response);
      } catch (error) {
        console.error("Failed to fetch growth data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGrowthData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <TrendingUp className="h-8 w-8 animate-pulse text-[hsl(24_95%_53%)]" />
          <p className={cn("text-sm font-medium", mutedTextClass)}>Loading growth analytics...</p>
        </div>
      </div>
    );
  }

  const { metrics, funnel, planBreakdown: dbPlanBreakdown, dailyGrowth } = data;

  const executiveMetricsList = [
    { title: "Total Users", value: metrics.totalUsers.toLocaleString(), change: "+12.4%", changeType: "up", icon: Users },
    { title: "Active Companies", value: metrics.activeCompanies.toLocaleString(), change: "+8.2%", changeType: "up", icon: Building2 },
    { title: "Active Projects", value: metrics.activeProjects.toLocaleString(), change: "+15.7%", changeType: "up", icon: FolderKanban },
    { title: "Freemium Users", value: metrics.freemiumUsers.toLocaleString(), change: "+6.1%", changeType: "up", icon: UserCheck },
    { title: "Paid Subscribers", value: metrics.paidSubscribers.toLocaleString(), change: "+22.3%", changeType: "up", icon: CreditCard },
    { title: "MRR", value: `₹${metrics.mrr.toLocaleString()}`, change: "+18.5%", changeType: "up", icon: DollarSign },
    { title: "ARR", value: `₹${metrics.arr.toLocaleString()}`, change: "+18.5%", changeType: "up", icon: TrendingUp },
    { title: "Conversion Rate", value: metrics.conversionRate, change: "+3.2%", changeType: "up", icon: Star },
  ];

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
        {executiveMetricsList.map((metric) => (
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
              <p className={cn("mb-3 text-xs", mutedTextClass)}>This week's daily signups</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyGrowth || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                <AreaChart data={data?.growthMonthly || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              {(funnel || []).map((step: any, index: number) => (
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Product Usage Analytics</h3>
            <p className={cn("mb-3 text-xs", mutedTextClass)}>How companies are using Apexis</p>
            <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-6">
              {[
                { label: "Projects Created", value: metrics.activeProjects.toLocaleString() },
                { label: "Drawings Uploaded", value: "1,420" },
                { label: "Drawing Releases", value: "470" },
                { label: "Chat Messages", value: "62,400" },
                { label: "Team Members Added", value: "3,180" },
                { label: "Client Members Added", value: "1,640" },
              ].map((metric) => (
                <div key={metric.label} className="rounded bg-[hsl(37_18%_91%/0.6)] p-2.5 dark:bg-[hsl(30_6%_18%)]">
                  <div className={cn("text-sm font-bold", strongTextClass)}>{metric.value}</div>
                  <div className={cn("text-[10px] font-medium uppercase tracking-wide", mutedTextClass)}>
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardClass, "overflow-hidden")}>
            <div className="px-5 py-5">
              <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Most Active Companies</h3>
              <p className={cn("text-xs", mutedTextClass)}>Top companies by platform usage</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)] text-xs">
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
                  {(data?.companyActivity || []).map((company: any) => (
                    <tr key={company.name}>
                      <td className={cn(tableCellClass, "font-medium", strongTextClass)}>{company.name}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.projects}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.team}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.drawings}</td>
                      <td className={cn(tableCellClass, strongTextClass)}>{company.messages.toLocaleString()}</td>
                      <td className={cn(tableCellClass, mutedTextClass)}>{company.lastActive}</td>
                      <td className={tableCellClass}>
                        <Pill className={company.plan === "Free" 
                          ? "border-[hsl(35_15%_85%)] bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)]" 
                          : "border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)]"}>
                          {company.plan}
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
          <div className={cn(cardClass, "flex flex-col p-5")}>
            <h3 className={cn("mb-1 text-sm font-semibold", strongTextClass)}>Plan Breakdown</h3>
            <p className={cn("mb-2 text-xs", mutedTextClass)}>Paid subscribers by plan</p>
            <div className="flex flex-1 items-center justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={dbPlanBreakdown || []} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                    {(dbPlanBreakdown || []).map((entry: any) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${chartGridStroke}` }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {(dbPlanBreakdown || []).map((plan: any) => (
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
              <div className={cn("text-lg font-bold", strongTextClass)}>₹{((metrics.mrr || 0) / (metrics.paidSubscribers || 1)).toFixed(0)}</div>
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-3 text-sm font-semibold", strongTextClass)}>Revenue Snapshot</h3>
            <div className="space-y-3">
              {[
                { label: "MRR", value: `₹${(metrics.mrr || 0).toLocaleString()}` },
                { label: "ARR", value: `₹${(metrics.arr || 0).toLocaleString()}` },
                { label: "ARPU", value: `₹${((metrics.mrr || 0) / (metrics.paidSubscribers || 1)).toFixed(0)}` },
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
              {(data?.feed || []).map((activity: any, index: number) => {
                const Icon = Activity;
                return (
                <div key={`${activity.text}-${index}`} className="flex items-start gap-3 border-b border-[hsl(35_15%_85%/0.5)] py-2.5 last:border-0 dark:border-[hsl(30_8%_22%)]">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0 text-[hsl(24_95%_53%)]")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs leading-relaxed", strongTextClass)}>{activity.text}</p>
                    <p className={cn("mt-0.5 text-[10px]", mutedTextClass)}>{new Date(activity.time).toLocaleTimeString()}</p>
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div className={cn(cardClass, "p-5")}>
            <h3 className={cn("mb-3 text-sm font-semibold", strongTextClass)}>Conversion Metrics</h3>
            <div className="space-y-3">
              {[
                { label: "Free → Paid Rate", value: metrics.conversionRate, color: "bg-emerald-500" },
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
                    <div className={cn("h-full rounded-full", metric.color)} style={{ width: (parseFloat(metric.value) || 0) + "%" }} />
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
