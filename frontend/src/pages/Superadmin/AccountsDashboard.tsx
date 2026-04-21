"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Heart,
  IndianRupee,
  LayoutDashboard,
  Percent,
  Repeat,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { getDashboardOverview, getOrganizations, getRevenueAnalytics } from "@/services/superadminService";
export type SubscriptionStatus = "Active" | "Expired" | "Cancelled";
export type PlanType = "Freemium" | "Standard" | "Professional";
export type RiskLevel = "High" | "Medium" | "Low";

const overviewMetrics = {
  totalUsers: { value: 0, growth: 0 },
  freemiumUsers: { value: 0, growth: 0 },
  paidSubscribers: { value: 0, growth: 0 },
  mrr: { value: 0, growth: 0 },
  totalRevenue: { value: 0, growth: 0 },
  conversionRate: { value: 0, growth: 0 },
};

const monthlyRevenueData = [
  { month: "Sep", mrr: 0, standard: 0, professional: 0 },
  { month: "Oct", mrr: 0, standard: 0, professional: 0 },
];

const userGrowthData = [
  { month: "Sep", users: 0 },
  { month: "Oct", users: 0 },
];

const churnRateData = [
  { month: "Sep", rate: 0 },
  { month: "Oct", rate: 0 },
];

const churnMetrics = {
  rate: "0%",
  trend: churnRateData
};

const feedbackData = [
  { reason: "Too expensive", count: 0 },
  { reason: "Missing features", count: 0 },
  { reason: "Switched to competitor", count: 0 },
  { reason: "Project ended", count: 0 },
  { reason: "Other", count: 0 },
];

const retentionData = {
  avgLifetime: 0,
  renewalRate: 0,
  freemiumToPaid: 0,
  paidToRenewed: 0,
  trend: [
    { month: "Sep", retention: 0 },
    { month: "Oct", retention: 0 },
  ],
};

const conversionFunnel = [
  { stage: "Signed Up", value: 0, pct: 100 },
  { stage: "Qualified", value: 0, pct: 0 },
];

const cardClass =
  "rounded border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]";
const mutedTextClass =
  "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";
const strongTextClass =
  "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";
const tableHeadClass =
  "border-b border-[hsl(35_15%_85%)] px-4 py-3 text-left text-xs font-semibold dark:border-[hsl(30_8%_22%)]";
const tableCellClass =
  "border-b border-[hsl(35_15%_85%/0.6)] px-4 py-3 text-xs align-top dark:border-[hsl(30_8%_22%/0.6)]";
const chartGridStroke = "hsl(35 15% 85%)";
const chartTickColor = "hsl(30 8% 45%)";
const pieColors = [
  "hsl(24 95% 53%)",
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(43 96% 56%)",
  "hsl(0 84% 60%)",
];
const reminderBaseDate = new Date("2026-04-20T00:00:00.000Z");

type AccountsTab =
  | "overview"
  | "revenue"
  | "subscriptions"
  | "conversions"
  | "reminders"
  | "growth"
  | "churn"
  | "exports";

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN")}`;

const formatCurrencyCompact = (value: number) =>
  `₹${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}K`;

const formatNumber = (value: number) => value.toLocaleString("en-IN");

const statusClass = (status: SubscriptionStatus) => {
  if (status === "Active") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "Expired") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
};

const planClass = (plan: PlanType) => {
  if (plan === "Freemium") {
    return "border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]";
  }
  if (plan === "Standard") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-500";
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
};

const riskClass = (risk?: RiskLevel) => {
  if (risk === "High") {
    return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (risk === "Medium") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
};

const getLeadStatus = (status: SubscriptionStatus, remaining?: number) => {
  if (status !== "Active" || !remaining) {
    return {
      label: "Expired",
      className:
        "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    };
  }

  if (remaining <= 7) {
    return {
      label: "Expiring Soon",
      className:
        "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    };
  }

  return {
    label: "Trial Active",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
};

const getReminderUrgency = (remaining: number) => {
  if (remaining <= 7) {
    return {
      label: `${remaining} days`,
      className:
        "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    };
  }

  if (remaining <= 20) {
    return {
      label: `${remaining} days`,
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: `${remaining} days`,
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
};

const getFollowUpDate = (remaining: number) => {
  const followUpDate = new Date(reminderBaseDate);
  followUpDate.setUTCDate(followUpDate.getUTCDate() + Math.min(remaining, 7));
  return followUpDate.toISOString().split("T")[0];
};

const downloadCsv = (
  rows: Record<string, string | number | boolean | null | undefined>[],
  filename: string,
) => {
  if (rows.length === 0) {
    toast.error("No data available for export");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);
  toast.success(`${filename}.csv downloaded successfully`);
};

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        className,
      )}>
      {children}
    </span>
  );
}

function MetricCard({
  title,
  value,
  growth,
  icon,
  color,
}: {
  title: string;
  value: string;
  growth?: number;
  icon: ReactNode;
  color?: string;
}) {
  const positive = growth !== undefined ? growth >= 0 : true;

  return (
    <div className={cn(cardClass, "p-5")}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div 
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]"
          style={color ? { backgroundColor: `${color}1A`, color: color } : {}}
        >
          {icon}
        </div>
        {growth !== undefined && (
          <Pill
            className={
              positive
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
            }>
            {positive ? "+" : ""}
            {growth}%
          </Pill>
        )}
      </div>
      <div className={cn("text-2xl font-bold", strongTextClass)}>{value}</div>
      <div className={cn("mt-1 text-sm", mutedTextClass)}>{title}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(cardClass, "p-5")}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className={cn("text-sm font-semibold", strongTextClass)}>
            {title}
          </h3>
          {description ? (
            <p className={cn("mt-1 text-xs", mutedTextClass)}>{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function RevenuePanels({ metrics, revenue }: { metrics: any; revenue: any }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl bg-[linear-gradient(135deg,hsl(24_95%_53%),hsl(18_84%_54%))] p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                Revenue Projection
              </p>
              <h2 className="mt-1 text-3xl font-bold">
                {formatCurrencyCompact(revenue?.projectedMRR || 0)}
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm text-white/80">
            Projected next-month MRR based on the current paid conversion trend.
          </p>
        </div>

        <div className={cn(cardClass, "grid grid-cols-2 gap-3 p-5")}>
          {[
            { label: "Current MRR", value: formatCurrencyCompact(metrics.mrr.value) },
            { label: "Total Revenue", value: formatCurrencyCompact(metrics.totalRevenue.value) },
            { label: "Paid Users", value: formatNumber(metrics.paidSubscribers.value) },
            { label: "Conversion Rate", value: `${metrics.conversionRate.value}%` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-[hsl(37_18%_91%/0.6)] p-3 dark:bg-[hsl(30_6%_18%)]">
              <div className={cn("text-lg font-bold", strongTextClass)}>
                {item.value}
              </div>
              <div
                className={cn(
                  "mt-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                  mutedTextClass,
                )}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="MRR Growth" description="Monthly recurring revenue trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenue?.revenueTrend || monthlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: chartTickColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartTickColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatCurrencyCompact(value)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${chartGridStroke}`,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="hsl(24 95% 53%)"
                strokeWidth={3}
                dot={{ fill: "hsl(24 95% 53%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Revenue by Plan" description="Standard vs professional contribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenue?.revenueTrend || monthlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: chartTickColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartTickColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatCurrencyCompact(value)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${chartGridStroke}`,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="standard"
                name="Standard"
                fill="hsl(217 91% 60%)"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="professional"
                name="Professional"
                fill="hsl(24 95% 53%)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

function GrowthPanels({ revenue }: { revenue: any }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title="New Users Per Month" description="Overall acquisition trend">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenue?.growthTrend || userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: chartTickColor }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: chartTickColor }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${chartGridStroke}`,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="newUsers"
              name="New Users"
              fill="hsl(24 95% 53%)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Freemium vs Paid Growth" description="Cohort growth by plan type">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenue?.growthTrend || userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: chartTickColor }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: chartTickColor }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${chartGridStroke}`,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="freemium"
              name="Freemium"
              stroke="hsl(43 96% 56%)"
              strokeWidth={2.5}
              dot={{ fill: "hsl(43 96% 56%)", r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="paid"
              name="Paid"
              stroke="hsl(160 84% 39%)"
              strokeWidth={2.5}
              dot={{ fill: "hsl(160 84% 39%)", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

export default function AccountsDashboard() {
  const [activeTab, setActiveTab] = useState<AccountsTab>("overview");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, revenueRes, orgsRes] = await Promise.all([
          getDashboardOverview(),
          getRevenueAnalytics(),
          getOrganizations()
        ]);
        setStats(overviewRes.stats);
        setRevenue(revenueRes);
        setAccountsList(orgsRes.organizations || []);
      } catch (error) {
        console.error("Failed to fetch account dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const dynamicOverviewMetrics = stats ? {
    totalUsers: { value: stats.totalUsers, growth: 12.5 },
    freemiumUsers: { value: stats.totalUsers - stats.activeProjects, growth: 8.3 },
    paidSubscribers: { value: stats.activeProjects, growth: 15.7 },
    mrr: { value: revenue?.mrr || 0, growth: 18.2 },
    totalRevenue: { value: (revenue?.mrr || 0) * 12, growth: 22.1 },
    conversionRate: { value: revenue?.conversionRate || 0, growth: 3.8 },
  } : overviewMetrics;

  const dynamicChurnMetrics = revenue?.churnMetrics || churnMetrics;

  const dynamicRetentionData = revenue?.retentionData || retentionData;

  const dynamicConversionFunnel = revenue?.conversionFunnel || conversionFunnel;
  
  const dynamicFeedbackData = revenue?.feedbackData || feedbackData;

  const [contacted, setContacted] = useState<Record<string, boolean>>(
    Object.fromEntries(
      accountsList.map((subscriber) => [subscriber.id, subscriber.contacted ?? false]),
    ),
  );

  const paidSubscribers = useMemo(
    () => accountsList.filter((subscriber) => subscriber.plan !== "Freemium"),
    [accountsList],
  );
  const freemiumSubscribers = useMemo(
    () => accountsList.filter((subscriber) => subscriber.plan === "Freemium"),
    [accountsList],
  );
  const cancelledUsers = useMemo(
    () =>
      accountsList.filter(
        (subscriber) =>
          subscriber.status === "Cancelled" &&
          (reasonFilter === "all" ||
            subscriber.cancellationReason === reasonFilter),
      ),
    [reasonFilter, accountsList],
  );
  const atRiskUsers = useMemo(
    () =>
      accountsList.filter(
        (subscriber) =>
          subscriber.status === "Active" &&
          (subscriber.riskLevel === "High" || subscriber.riskLevel === "Medium"),
      ),
    [accountsList],
  );
  const reminderUsers = useMemo(
    () =>
      freemiumSubscribers.filter(
        (subscriber) =>
          subscriber.status === "Active" &&
          typeof subscriber.trialDaysRemaining === "number" &&
          subscriber.trialDaysRemaining > 0 &&
          subscriber.trialDaysRemaining <= 60,
      ),
    [freemiumSubscribers],
  );
  const filteredSubscriptions = useMemo(
    () =>
      accountsList.filter((subscriber: any) => {
        const search = subscriptionSearch.toLowerCase();
        const matchesSearch =
          !subscriptionSearch ||
          subscriber.name.toLowerCase().includes(search) ||
          subscriber.email.toLowerCase().includes(search) ||
          subscriber.company.toLowerCase().includes(search);

        if (!matchesSearch) return false;
        if (planFilter !== "all" && subscriber.plan !== planFilter) return false;
        if (statusFilter !== "all" && subscriber.status !== statusFilter) return false;
        return true;
      }),
    [planFilter, statusFilter, subscriptionSearch, accountsList],
  );

  const subscriptionSummary = useMemo(
    () => ({
      total: accountsList.length,
      active: accountsList.filter((subscriber: any) => subscriber.status === "Active").length,
      expired: accountsList.filter((subscriber: any) => subscriber.status === "Expired").length,
      cancelled: accountsList.filter((subscriber: any) => subscriber.status === "Cancelled").length,
    }),
    [accountsList],
  );

  const tabs: { value: AccountsTab; label: string; icon: ReactNode }[] = [
    {
      value: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      value: "revenue",
      label: "Revenue",
      icon: <IndianRupee className="h-4 w-4" />,
    },
    {
      value: "subscriptions",
      label: "Subscriptions",
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: "conversions",
      label: "Conversions",
      icon: <Repeat className="h-4 w-4" />,
    },
    {
      value: "reminders",
      label: "Reminders",
      icon: <Bell className="h-4 w-4" />,
    },
    {
      value: "growth",
      label: "User Growth",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      value: "churn",
      label: "Churn & Retention",
      icon: <TrendingDown className="h-4 w-4" />,
    },
    {
      value: "exports",
      label: "Exports",
      icon: <Download className="h-4 w-4" />,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <LayoutDashboard className="h-8 w-8 animate-spin text-[hsl(24_95%_53%)]" />
          <p className={cn("text-sm font-medium", mutedTextClass)}>Loading account insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.24em]",
              mutedTextClass,
            )}>
            Accounts
          </div>
          <h1 className={cn("mt-2 text-2xl font-bold", strongTextClass)}>
            Accounts Dashboard
          </h1>
          <p className={cn("mt-2 max-w-2xl text-sm", mutedTextClass)}>
            Revenue, subscription health, conversion momentum, and churn signals
            for the Apexis platform.
          </p>
        </div>

        <div className="rounded-2xl bg-[linear-gradient(135deg,hsl(24_95%_53%),hsl(12_82%_58%))] p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                This Month
              </div>
              <div className="mt-2 text-3xl font-bold">
                {formatCurrencyCompact(dynamicOverviewMetrics.mrr.value)}
              </div>
              <div className="mt-1 text-sm text-white/80">
                Current recurring revenue
              </div>
            </div>
            <Pill className="border-white/20 bg-white/10 text-white">
              +18.2%
            </Pill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-white/70">Projected MRR</div>
              <div className="mt-1 font-semibold">
                {formatCurrencyCompact(revenue?.projectedMRR || 0)}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-white/70">Paid Subscribers</div>
              <div className="mt-1 font-semibold">
                {formatNumber(dynamicOverviewMetrics.paidSubscribers.value)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AccountsTab)}
        className="space-y-6">
        <div className={cn(cardClass, "p-2")}>
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-max gap-2 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(30_8%_45%)] data-[state=active]:border-[hsl(24_95%_53%/0.18)] data-[state=active]:bg-[hsl(24_95%_53%)] data-[state=active]:text-white dark:text-[hsl(38_10%_55%)]">
                  {tab.icon}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Total Registered Users"
              value={formatNumber(dynamicOverviewMetrics.totalUsers.value)}
              growth={dynamicOverviewMetrics.totalUsers.growth}
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Active Freemium Users"
              value={formatNumber(dynamicOverviewMetrics.freemiumUsers.value)}
              growth={dynamicOverviewMetrics.freemiumUsers.growth}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <MetricCard
              title="Paid Subscribers"
              value={formatNumber(dynamicOverviewMetrics.paidSubscribers.value)}
              growth={dynamicOverviewMetrics.paidSubscribers.growth}
              icon={<CreditCard className="h-5 w-5" />}
            />
            <MetricCard
              title="Monthly Recurring Revenue"
              value={formatCurrencyCompact(dynamicOverviewMetrics.mrr.value)}
              growth={dynamicOverviewMetrics.mrr.growth}
              icon={<IndianRupee className="h-5 w-5" />}
            />
            <MetricCard
              title="Total Revenue Generated"
              value={formatCurrencyCompact(revenue?.stats?.totalRevenue || (revenue?.mrr || 0) * 12)}
              growth={22.1}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              title="Conversion Rate"
              value={`${dynamicOverviewMetrics.conversionRate.value}%`}
              growth={dynamicOverviewMetrics.conversionRate.growth}
              icon={<Repeat className="h-5 w-5" />}
            />
          </div>

          <RevenuePanels metrics={dynamicOverviewMetrics} revenue={revenue} />
          <GrowthPanels revenue={revenue} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <RevenuePanels metrics={dynamicOverviewMetrics} revenue={revenue} />

          <SectionCard title="Lifetime Revenue" description="Cumulative revenue generated to date">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]">
                <IndianRupee className="h-7 w-7" />
              </div>
              <div>
                <div className={cn("text-3xl font-bold", strongTextClass)}>
                  {formatCurrency(dynamicOverviewMetrics.totalRevenue.value)}
                </div>
                <div className={cn("mt-1 text-sm", mutedTextClass)}>
                  Lifetime revenue generated across all paid plans.
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total Accounts",
                value: subscriptionSummary.total,
                accent: "bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]",
                icon: <Users className="h-4 w-4" />,
              },
              {
                label: "Active",
                value: subscriptionSummary.active,
                accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                icon: <CheckCircle2 className="h-4 w-4" />,
              },
              {
                label: "Expired",
                value: subscriptionSummary.expired,
                accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                icon: <Clock className="h-4 w-4" />,
              },
              {
                label: "Cancelled",
                value: subscriptionSummary.cancelled,
                accent: "bg-red-500/10 text-red-600 dark:text-red-400",
                icon: <XCircle className="h-4 w-4" />,
              },
            ].map((item) => (
              <div key={item.label} className={cn(cardClass, "p-4")}>
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      item.accent,
                    )}>
                    {item.icon}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-[0.14em]",
                      mutedTextClass,
                    )}>
                    {item.label}
                  </span>
                </div>
                <div className={cn("text-2xl font-bold", strongTextClass)}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <SectionCard
            title="Subscription Breakdown"
            description="Filter by plan, status, or any customer detail"
            action={
              <div className={cn("text-xs", mutedTextClass)}>
                Showing {filteredSubscriptions.length} of {accountsList.length} accounts
              </div>
            }>
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className={cn(
                    "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                    mutedTextClass,
                  )}
                />
                <Input
                  placeholder="Search users, email, company..."
                  value={subscriptionSearch}
                  onChange={(event) => setSubscriptionSearch(event.target.value)}
                  className="h-10 pl-9"
                />
              </div>

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-10 w-[170px]">
                  <SelectValue placeholder="Plan Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="Freemium">Freemium</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    {[
                      "Name",
                      "Email",
                      "Phone",
                      "Company",
                      "Plan",
                      "Start Date",
                      "Trial Expiry",
                      "Next Billing",
                      "Status",
                    ].map((header) => (
                      <th key={header} className={tableHeadClass}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((subscriber) => (
                    <tr
                      key={subscriber.id}
                      className="transition-colors hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                      <td className={tableCellClass}>
                        <div className={cn("font-medium", strongTextClass)}>
                          {subscriber.name}
                        </div>
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.email}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.phone}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.company}
                      </td>
                      <td className={tableCellClass}>
                        <Pill className={planClass(subscriber.plan)}>
                          {subscriber.plan}
                        </Pill>
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.startDate}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.trialExpiry}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.nextBilling}
                      </td>
                      <td className={tableCellClass}>
                        <Pill className={statusClass(subscriber.status)}>
                          {subscriber.status}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                  {filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className={cn(
                          "py-8 text-center text-sm",
                          mutedTextClass,
                        )}>
                        No matching users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.isArray(dynamicConversionFunnel) ? dynamicConversionFunnel.map((step: any, index: number) => (
              <div key={step.stage} className={cn(cardClass, "p-5 text-center")}>
                <div className={cn("text-3xl font-bold", strongTextClass)}>
                  {step.value.toLocaleString()}
                </div>
                <div className="mt-3">
                  <Pill className={
                    index === 0 ? "border-[hsl(24_95%_53%/0.2)] bg-[hsl(24_95%_53%/0.08)] text-[hsl(24_95%_53%)]" :
                    index === 1 ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                    index === 2 ? "border-sky-500/20 bg-sky-500/10 text-sky-500" :
                    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }>{step.stage}</Pill>
                </div>
              </div>
            )) : null}
          </div>

          <SectionCard
            title="Lead Generation Table"
            description="Freemium users currently in the trial funnel">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    {[
                      "Email",
                      "Phone",
                      "Company",
                      "Trial Days Left",
                      "Last Login",
                      "Status",
                    ].map((header) => (
                      <th key={header} className={tableHeadClass}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {freemiumSubscribers.map((subscriber) => {
                    const tag = getLeadStatus(
                      subscriber.status,
                      subscriber.trialDaysRemaining,
                    );

                    return (
                      <tr
                        key={subscriber.id}
                        className="transition-colors hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                        <td className={cn(tableCellClass, strongTextClass)}>
                          {subscriber.email}
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {subscriber.phone}
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {subscriber.company}
                        </td>
                        <td className={cn(tableCellClass, strongTextClass)}>
                          {subscriber.trialDaysRemaining ?? "-"}
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {subscriber.lastLogin}
                        </td>
                        <td className={tableCellClass}>
                          <Pill className={tag.className}>{tag.label}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-6">
          <SectionCard
            title="Conversion Reminder System"
            description="Freemium users in the reminder window with suggested follow-up dates">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    {[
                      "User",
                      "Email",
                      "Phone",
                      "Days Remaining",
                      "Suggested Follow-up",
                      "Contacted",
                    ].map((header) => (
                      <th key={header} className={tableHeadClass}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reminderUsers.map((subscriber) => {
                    const remaining = subscriber.trialDaysRemaining ?? 0;
                    const urgency = getReminderUrgency(remaining);

                    return (
                      <tr
                        key={subscriber.id}
                        className="transition-colors hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                        <td className={cn(tableCellClass, strongTextClass)}>
                          {subscriber.name}
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {subscriber.email}
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {subscriber.phone}
                        </td>
                        <td className={tableCellClass}>
                          <Pill className={urgency.className}>{urgency.label}</Pill>
                        </td>
                        <td className={cn(tableCellClass, mutedTextClass)}>
                          {getFollowUpDate(remaining)}
                        </td>
                        <td className={tableCellClass}>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setContacted((previous) => ({
                                ...previous,
                                [subscriber.id]: !previous[subscriber.id],
                              }))
                            }
                            className={cn(
                              "h-9 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em]",
                              contacted[subscriber.id]
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
                                : "border-[hsl(35_15%_85%)] bg-transparent text-[hsl(30_8%_45%)] hover:bg-[hsl(37_18%_91%)] dark:border-[hsl(30_8%_22%)] dark:text-[hsl(38_10%_55%)] dark:hover:bg-[hsl(30_6%_18%)]",
                            )}>
                            {contacted[subscriber.id] ? "Contacted" : "Mark Pending"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {reminderUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className={cn(
                          "py-8 text-center text-sm",
                          mutedTextClass,
                        )}>
                        No users in the reminder window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="growth" className="space-y-6">
          <GrowthPanels revenue={revenue} />
        </TabsContent>

        <TabsContent value="churn" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Active Subscribers"
              value={formatNumber(dynamicChurnMetrics.activeSubscribers.value)}
              growth={dynamicChurnMetrics.activeSubscribers.growth}
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Cancelled Subscriptions"
              value={formatNumber(dynamicChurnMetrics.cancelledSubscriptions.value)}
              growth={dynamicChurnMetrics.cancelledSubscriptions.growth}
              icon={<XCircle className="h-5 w-5" />}
            />
            <MetricCard
              title="Monthly Churn Rate"
              value={`${dynamicChurnMetrics.monthlyChurnRate.value}%`}
              growth={dynamicChurnMetrics.monthlyChurnRate.growth}
              icon={<Percent className="h-5 w-5" />}
            />
            <MetricCard
              title="Revenue Lost to Churn"
              value={formatCurrencyCompact(dynamicChurnMetrics.revenueLost.value)}
              growth={dynamicChurnMetrics.revenueLost.growth}
              icon={<IndianRupee className="h-5 w-5" />}
            />
            <MetricCard
              title="Customer Lifetime Value"
              value={formatCurrency(dynamicChurnMetrics.clv.value)}
              growth={dynamicChurnMetrics.clv.growth}
              icon={<Heart className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Monthly Churn Rate" description="Rate trend over time">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={churnRateData /* Keep for now as trend data is not yet in backend */}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${chartGridStroke}`,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(0 84% 60%)"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(0 84% 60%)", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Cancelled Users" description="Raw count of churned accounts">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={churnRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${chartGridStroke}`,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="cancelled"
                    name="Cancelled"
                    fill="hsl(0 84% 60%)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Retention Analytics" description="Key lifecycle performance metrics">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Avg User Lifetime",
                    value: `${dynamicRetentionData.avgLifetime} months`,
                  },
                  {
                    label: "Renewal Rate",
                    value: `${dynamicRetentionData.renewalRate}%`,
                  },
                  {
                    label: "Freemium → Paid",
                    value: `${dynamicRetentionData.freemiumToPaid}%`,
                  },
                  {
                    label: "Paid → Renewed",
                    value: `${dynamicRetentionData.paidToRenewed}%`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-[hsl(37_18%_91%/0.6)] p-4 text-center dark:bg-[hsl(30_6%_18%)]">
                    <div className={cn("text-2xl font-bold", strongTextClass)}>
                      {item.value}
                    </div>
                    <div className={cn("mt-1 text-xs", mutedTextClass)}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Cancellation Reasons" description="Reason distribution across churned users">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={dynamicFeedbackData}
                    dataKey="count"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={82}>
                    {dynamicFeedbackData.map((item: any, index: number) => (
                      <Cell
                        key={item.reason}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${chartGridStroke}`,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {dynamicFeedbackData.map((item: any, index: number) => (
                  <div key={item.reason} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: pieColors[index % pieColors.length] }}
                    />
                    <span className={cn("font-medium", strongTextClass)}>
                      {item.reason}
                    </span>
                    <span className={cn("ml-auto", mutedTextClass)}>{item.count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="At-Risk Users"
            description="Accounts showing medium or high churn signals">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span className={cn("text-xs font-medium", mutedTextClass)}>
                {atRiskUsers.length} accounts need closer follow-up
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    {["Name", "Email", "Phone", "Last Login", "Plan", "Risk Level"].map(
                      (header) => (
                        <th key={header} className={tableHeadClass}>
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {atRiskUsers.map((subscriber) => (
                    <tr
                      key={subscriber.id}
                      className="transition-colors hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                      <td className={cn(tableCellClass, strongTextClass)}>
                        {subscriber.name}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.email}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.phone}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.lastLogin}
                      </td>
                      <td className={tableCellClass}>
                        <Pill className={planClass(subscriber.plan)}>
                          {subscriber.plan}
                        </Pill>
                      </td>
                      <td className={tableCellClass}>
                        <Pill className={riskClass(subscriber.riskLevel)}>
                          {subscriber.riskLevel ?? "Low"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Churned Users"
            description="Filter churn reasons to inspect the most recent losses"
            action={
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="h-10 w-[220px]">
                  <SelectValue placeholder="All Reasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="Too expensive">Too expensive</SelectItem>
                  <SelectItem value="Not useful enough">
                    Not useful enough
                  </SelectItem>
                  <SelectItem value="Switching to another tool">
                    Switching to another tool
                  </SelectItem>
                  <SelectItem value="Project completed">
                    Project completed
                  </SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            }>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
                  <tr>
                    {[
                      "Name",
                      "Email",
                      "Phone",
                      "Company",
                      "Plan",
                      "Start Date",
                      "Cancelled",
                      "Last Login",
                      "Months",
                      "Reason",
                    ].map((header) => (
                      <th key={header} className={tableHeadClass}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cancelledUsers.map((subscriber) => (
                    <tr
                      key={subscriber.id}
                      className="transition-colors hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-[hsl(30_6%_18%/0.7)]">
                      <td className={cn(tableCellClass, strongTextClass)}>
                        {subscriber.name}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.email}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.phone}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.company}
                      </td>
                      <td className={tableCellClass}>
                        <Pill className={planClass(subscriber.plan)}>
                          {subscriber.plan}
                        </Pill>
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.startDate}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.cancellationDate}
                      </td>
                      <td className={cn(tableCellClass, mutedTextClass)}>
                        {subscriber.lastLogin}
                      </td>
                      <td className={cn(tableCellClass, strongTextClass)}>
                        {subscriber.totalMonthsSubscribed}
                      </td>
                      <td className={tableCellClass}>
                        <Pill className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
                          {subscriber.cancellationReason ?? "Other"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                  {cancelledUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className={cn(
                          "py-8 text-center text-sm",
                          mutedTextClass,
                        )}>
                        No churned users found for this reason.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="exports" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Subscriber List",
                value: paidSubscribers.length,
                icon: <Users className="h-4 w-4" />,
              },
              {
                label: "Freemium Leads",
                value: freemiumSubscribers.length,
                icon: <UserCheck className="h-4 w-4" />,
              },
              {
                label: "At-Risk Users",
                value: atRiskUsers.length,
                icon: <AlertTriangle className="h-4 w-4" />,
              },
              {
                label: "Churned Users",
                value: accountsList.filter((subscriber) => subscriber.status === "Cancelled").length,
                icon: <UserMinus className="h-4 w-4" />,
              },
            ].map((item) => (
              <div key={item.label} className={cn(cardClass, "p-4")}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]">
                    {item.icon}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-[0.14em]",
                      mutedTextClass,
                    )}>
                    {item.label}
                  </span>
                </div>
                <div className={cn("text-2xl font-bold", strongTextClass)}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <SectionCard
            title="Export Reports"
            description="Download curated CSV exports for the accounts team">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadCsv(
                    (revenue?.revenueTrend || []).map((row: any) => ({
                      Month: row.month,
                      MRR: row.mrr,
                      Standard: row.standard,
                      Professional: row.professional,
                    })),
                    "revenue_report",
                  )
                }>
                <FileSpreadsheet className="h-4 w-4" />
                Revenue Report
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadCsv(
                    paidSubscribers.map((subscriber) => ({
                      Name: subscriber.name,
                      Email: subscriber.email,
                      Phone: subscriber.phone,
                      Company: subscriber.company,
                      Plan: subscriber.plan,
                      Status: subscriber.status,
                      NextBilling: subscriber.nextBilling,
                    })),
                    "subscriber_list",
                  )
                }>
                <Users className="h-4 w-4" />
                Subscriber List
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadCsv(
                    freemiumSubscribers.map((subscriber) => ({
                      Name: subscriber.name,
                      Email: subscriber.email,
                      Phone: subscriber.phone,
                      Company: subscriber.company,
                      TrialDaysRemaining: subscriber.trialDaysRemaining,
                      LastLogin: subscriber.lastLogin,
                    })),
                    "freemium_leads",
                  )
                }>
                <Download className="h-4 w-4" />
                Freemium Leads
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadCsv(
                    cancelledUsers.map((subscriber) => ({
                      Name: subscriber.name,
                      Email: subscriber.email,
                      Company: subscriber.company,
                      Plan: subscriber.plan,
                      CancellationDate: subscriber.cancellationDate,
                      Reason: subscriber.cancellationReason,
                    })),
                    "churn_report",
                  )
                }>
                <UserMinus className="h-4 w-4" />
                Churn Report
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadCsv(
                    atRiskUsers.map((subscriber) => ({
                      Name: subscriber.name,
                      Email: subscriber.email,
                      Plan: subscriber.plan,
                      RiskLevel: subscriber.riskLevel,
                      LastLogin: subscriber.lastLogin,
                    })),
                    "at_risk_users",
                  )
                }>
                <AlertTriangle className="h-4 w-4" />
                At-Risk Users
              </Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
