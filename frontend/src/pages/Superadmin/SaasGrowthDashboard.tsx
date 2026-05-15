"use client";

import { useEffect, useState } from "react";
import {
  Users, Building2, FolderKanban, UserCheck, CreditCard, DollarSign,
  TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Filter,
  Upload, Camera, CheckCircle, MessageSquare, AlertCircle, UserPlus, Star
} from "lucide-react";

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

// ── Mock Data ──────────────────────────────────────────

// const executiveMetrics = [
//   { title: "Total Users", value: "4,820", change: "+12.4%", changeType: "up", icon: Users },
//   { title: "Active Companies", value: "184", change: "+8.2%", changeType: "up", icon: Building2 },
//   { title: "Active Projects", value: "612", change: "+15.7%", changeType: "up", icon: FolderKanban },
//   { title: "Freemium Users", value: "3,240", change: "+6.1%", changeType: "up", icon: UserCheck },
//   { title: "Paid Subscribers", value: "1,580", change: "+22.3%", changeType: "up", icon: CreditCard },
//   { title: "MRR", value: "₹4,12,800", change: "+18.5%", changeType: "up", icon: DollarSign },
//   { title: "ARR", value: "₹49,53,600", change: "+18.5%", changeType: "up", icon: TrendingUp },
//   { title: "Conversion Rate", value: "32.8%", change: "+3.2%", changeType: "up", icon: Star },
// ];

// const userGrowthDaily = [
//   { day: "Mon", users: 42 }, { day: "Tue", users: 58 }, { day: "Wed", users: 35 },
//   { day: "Thu", users: 71 }, { day: "Fri", users: 63 }, { day: "Sat", users: 28 },
//   { day: "Sun", users: 19 },
// ];

// const userGrowthMonthly = [
//   { month: "Sep", users: 320 }, { month: "Oct", users: 580 }, { month: "Nov", users: 890 },
//   { month: "Dec", users: 1240 }, { month: "Jan", users: 1820 }, { month: "Feb", users: 2650 },
//   { month: "Mar", users: 3410 }, { month: "Apr", users: 4820 },
// ];


// const funnelData = [
//   { stage: "Signed Up", value: 4820, pct: 100 },
//   { stage: "Started Trial", value: 3860, pct: 80.1 },
//   { stage: "Actively Using", value: 2510, pct: 52.1 },
//   { stage: "Converted to Paid", value: 1580, pct: 32.8 },
// ];

// const revenueMonthly = [
//   { month: "Sep", mrr: 84000, standard: 52000, professional: 32000 },
//   { month: "Oct", mrr: 142000, standard: 88000, professional: 54000 },
//   { month: "Nov", mrr: 198000, standard: 121000, professional: 77000 },
//   { month: "Dec", mrr: 256000, standard: 156000, professional: 100000 },
//   { month: "Jan", mrr: 312000, standard: 189000, professional: 123000 },
//   { month: "Feb", mrr: 368000, standard: 220000, professional: 148000 },
//   { month: "Mar", mrr: 412800, standard: 245000, professional: 167800 },
// ];

// const planBreakdown = [
//   { name: "Standard ₹199", value: 920, color: "hsl(25, 95%, 53%)" },
//   { name: "Professional ₹299", value: 660, color: "#e98b06" },
// ];

// const productUsageData = [
//   { month: "Oct", projects: 120, drawings: 340, messages: 8200, releases: 85 },
//   { month: "Nov", projects: 185, drawings: 520, messages: 14500, releases: 140 },
//   { month: "Dec", projects: 280, drawings: 710, messages: 22300, releases: 210 },
//   { month: "Jan", projects: 390, drawings: 950, messages: 34800, releases: 295 },
//   { month: "Feb", projects: 490, drawings: 1180, messages: 48200, releases: 380 },
//   { month: "Mar", projects: 612, drawings: 1420, messages: 62400, releases: 470 },
// ];

// const productUsageMetrics = [
//   { label: "Projects Created", value: "612" },
//   { label: "Drawings Uploaded", value: "1,420" },
//   { label: "Drawing Releases", value: "470" },
//   { label: "Chat Messages", value: "62,400" },
//   { label: "Team Members Added", value: "3,180" },
//   { label: "Client Members Added", value: "1,640" },
// ];


// const companyActivity = [
//   { name: "Skyline Constructions", projects: 18, team: 42, drawings: 320, messages: 8400, lastActive: "2 min ago", plan: "₹299" },
//   { name: "Metro Builders", projects: 14, team: 35, drawings: 240, messages: 6200, lastActive: "5 min ago", plan: "₹299" },
//   { name: "ARC Architects", projects: 11, team: 28, drawings: 185, messages: 4800, lastActive: "12 min ago", plan: "₹199" },
//   { name: "Greenfield Homes", projects: 8, team: 22, drawings: 140, messages: 3600, lastActive: "1 hr ago", plan: "₹199" },
//   { name: "Prime Developers", projects: 6, team: 18, drawings: 95, messages: 2100, lastActive: "3 hr ago", plan: "Free" },
//   { name: "Urban Spaces", projects: 5, team: 15, drawings: 82, messages: 1800, lastActive: "5 hr ago", plan: "Free" },
// ];


// const conversionOpportunities = [
//   { name: "Prime Developers", email: "info@primedev.com", phone: "+91 9876543210", projects: 6, drawings: 95, teamSize: 18, daysLeft: 12, activity: "High" },
//   { name: "Urban Spaces", email: "hello@urbanspaces.in", phone: "+91 9123456789", projects: 5, drawings: 82, teamSize: 15, daysLeft: 18, activity: "High" },
//   { name: "Coastal Builders", email: "ops@coastal.com", phone: "+91 8765432190", projects: 3, drawings: 48, teamSize: 10, daysLeft: 24, activity: "Medium" },
//   { name: "Apex Infra", email: "admin@apexinfra.in", phone: "+91 7654321098", projects: 4, drawings: 62, teamSize: 12, daysLeft: 8, activity: "High" },
// ];


// const activityFeed = [
//   { icon: UserPlus, text: "Coastal Builders signed up for Apexis", time: "1 min ago", color: "text-chart-2" },
//   { icon: FolderKanban, text: "New project 'Marina Heights' created by Metro Builders", time: "3 min ago", color: "text-primary" },
//   { icon: Upload, text: "32 drawings uploaded – Skyline Phase 3", time: "8 min ago", color: "text-chart-3" },
//   { icon: CreditCard, text: "ARC Architects upgraded to Professional ₹299", time: "15 min ago", color: "text-success" },
//   { icon: Camera, text: "Site progress photos posted – Greenfield Homes", time: "22 min ago", color: "text-primary" },
//   { icon: CheckCircle, text: "48 tasks completed today across 12 projects", time: "30 min ago", color: "text-chart-3" },
//   { icon: MessageSquare, text: "Team discussion started on structural specs – Prime Dev", time: "45 min ago", color: "text-chart-2" },
//   { icon: AlertCircle, text: "RFI raised for waterproofing details – Coastal Builders", time: "1 hr ago", color: "text-warning" },
// ];

// ── Components ─────────────────────────────────────────

const ChangeIndicator = ({ change, type }: { change: string; type: string }) => {
  const color = type === "up" ? "text-success" : type === "down" ? "text-destructive" : "text-muted-foreground";
  const Icon = type === "up" ? ArrowUpRight : type === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" /> {change}
    </span>
  );
};

const SaasGrowthDashboard = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState("allTime");
  const timeRanges = [
    { key: "today", label: "Today" },
    { key: "7days", label: "7 Days" },
    { key: "30days", label: "30 Days" },
    { key: "allTime", label: "All Time" },
  ];

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


  const dashboardStats = data?.[timeRange] || {};

  const executiveMetrics = [
    { 
      title: "Total Users", 
      value: String(dashboardStats?.totalUsers?.total ?? 0), 
      change: dashboardStats?.totalUsers?.text || "0%", 
      changeType: dashboardStats?.totalUsers?.type || "neutral", 
      icon: Users 
    },
    { 
      title: "Active Companies", 
      value: String(dashboardStats?.activeCompanies?.total ?? 0), 
      change: dashboardStats?.activeCompanies?.text || "0%", 
      changeType: dashboardStats?.activeCompanies?.type || "neutral", 
      icon: Building2 
    },
    { 
      title: "Active Projects", 
      value: String(dashboardStats?.activeProjects?.total ?? 0), 
      change: dashboardStats?.activeProjects?.text || "0%", 
      changeType: dashboardStats?.activeProjects?.type || "neutral", 
      icon: FolderKanban 
    },
    { 
      title: "Freemium Users", 
      value: String(dashboardStats?.freemiumUsers?.total ?? 0), 
      change: dashboardStats?.freemiumUsers?.text || "0%", 
      changeType: dashboardStats?.freemiumUsers?.type || "neutral", 
      icon: UserCheck 
    },
    { 
      title: "Paid Subscribers", 
      value: String(dashboardStats?.paidSubscribers?.total ?? 0), 
      change: dashboardStats?.paidSubscribers?.text || "0%", 
      changeType: dashboardStats?.paidSubscribers?.type || "neutral", 
      icon: CreditCard 
    },
    { 
      title: "MRR", 
      value: "₹" + Number(dashboardStats?.mrr?.total ?? 0).toLocaleString(), 
      change: dashboardStats?.mrr?.text || "0%", 
      changeType: dashboardStats?.mrr?.type || "neutral", 
      icon: DollarSign 
    },
    { 
      title: "ARR", 
      value: "₹" + Number(dashboardStats?.arr?.total ?? 0).toLocaleString(), 
      change: dashboardStats?.arr?.text || "0%", 
      changeType: dashboardStats?.arr?.type || "neutral", 
      icon: TrendingUp 
    },
    { 
      title: "Conversion Rate", 
      value: String(dashboardStats?.conversionRate?.total ?? "0%"), 
      change: dashboardStats?.conversionRate?.text || "0%", 
      changeType: dashboardStats?.conversionRate?.type || "neutral", 
      icon: Star 
    },
  ];


  // const { metrics, funnel, planBreakdown: dbPlanBreakdown, dailyGrowth } = data;

  return (
    <div className={pageShellClass}>
      <main className="">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-display text-foreground">SaaS Growth Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Executive overview — platform health & growth</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] p-1 dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] mr-12">
            {timeRanges.map((range) => (
              <button
                key={range.key}
                onClick={() => setTimeRange(range.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11px] font-medium transition-all",
                  timeRange === range.key
                    ? "bg-[hsl(24_95%_53%)] text-white shadow-sm"
                    : "text-[hsl(30_8%_45%)] hover:bg-[hsl(37_18%_91%)] dark:text-[hsl(38_10%_55%)] dark:hover:bg-[hsl(30_6%_18%)]"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Executive Summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {executiveMetrics.map((m) => (
            <div key={m.title} className="bg-card rounded border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.title}</span>
                <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                  <m.icon className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold font-display text-card-foreground">{m.value}</div>
              <ChangeIndicator change={m.change} type={m.changeType} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left 8 cols */}
          <div className="col-span-8 space-y-4">

            {/* 2. User Growth */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card rounded border border-border p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">New Users Per Day</h3>
                <p className="text-xs text-muted-foreground mb-3">This week's daily signups</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data?.dailyGrowth || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214,20%,90%)" }} />
                    <Bar dataKey="users" fill="hsl(25,95%,53%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded border border-border p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">Total User Growth</h3>
                <p className="text-xs text-muted-foreground mb-3">Cumulative users over time</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data?.userGrowthMonthly || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>

                    <defs>
                      <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(25,95%,53%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(25,95%,53%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214,20%,90%)" }} />
                    <Area type="monotone" dataKey="users" stroke="hsl(25,95%,53%)" strokeWidth={2} fill="url(#ugGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Freemium Funnel */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-1">Freemium Funnel</h3>
              <p className="text-xs text-muted-foreground mb-4">Conversion from signup to paid</p>
              <div className="space-y-3">
                {data?.funnel?.map((step: any, i: number) => (
                  <div key={step.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-card-foreground">
                        Step {i + 1}: {step.stage}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {step.value.toLocaleString()} ({step.pct}%)
                      </span>
                    </div>
                    <div className="h-7 bg-muted rounded-sm overflow-hidden relative">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{
                          width: `${step.pct}%`,
                          background: `linear-gradient(90deg, hsl(25,95%,53%), hsl(25,95%,${53 + i * 6}%))`,
                          opacity: 1 - i * 0.15,
                        }}
                      />
                      {i < data?.funnel?.length - 1 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                          → {((data?.funnel?.[i + 1]?.value / step.value) * 100).toFixed(1)}% conversion
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Revenue Performance */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-card rounded border border-border p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">Revenue Growth</h3>
                <p className="text-xs text-muted-foreground mb-3">MRR breakdown by plan</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.revenueGrowth} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214,20%,90%)" }} formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString()}`, name]} />
                    {(data?.planBreakdown || []).map((plan: any) => (
                      <Area
                        key={plan.name}
                        type="monotone"
                        dataKey={plan.name.toLowerCase()}
                        name={plan.name}
                        stroke={plan.color}
                        fill={plan.color}
                        fillOpacity={0.1}
                        strokeWidth={2}
                        stackId="1"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded border border-border p-5 flex flex-col">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">Plan Breakdown</h3>
                <p className="text-xs text-muted-foreground mb-2">Paid subscribers by plan</p>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={data?.planBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                        {data?.planBreakdown?.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214,20%,90%)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {data?.planBreakdown?.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </div>
                      <span className="font-semibold text-card-foreground">{p.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">ARPU</div>
                  <div className="text-lg font-bold font-display text-card-foreground">₹{(dashboardStats?.arpu || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 5. Product Usage Analytics */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-1">Product Usage Analytics</h3>
              <p className="text-xs text-muted-foreground mb-3">How companies are using Apexis</p>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {[
                  { label: "Projects", value: data?.productUsageData?.[5]?.projects || 0 },
                  { label: "Photos", value: data?.productUsageData?.[5]?.photos || 0 },
                  { label: "PDFs", value: data?.productUsageData?.[5]?.pdfs || 0 },
                  { label: "Messages", value: data?.productUsageData?.[5]?.messages || 0 },
                  // { label: "Documents", value: data?.productUsageData?.[5]?.releases || 0 },
                  { label: "Users", value: data?.allTime?.totalUsers?.total || 0 },
                  { label: "Companies", value: data?.allTime?.activeCompanies?.total || 0 },
                ].map((m: any) => (
                  <div key={m.label} className="bg-muted/50 rounded p-2.5">
                    <div className="text-sm font-bold font-display text-card-foreground">{m.value.toLocaleString()}</div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{m.label}</div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data?.productUsageData || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>

                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215,10%,45%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214,20%,90%)" }} />
                  <Line type="monotone" dataKey="projects" name="Projects" stroke="hsl(25,95%,53%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="photos" name="Photos" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pdfs" name="PDFs" stroke="hsl(160,84%,39%)" strokeWidth={2} dot={false} />
                  {/* <Line type="monotone" dataKey="releases" name="Releases" stroke="hsl(37,18%,60%)" strokeWidth={2} dot={false} /> */}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 6. Company Activity */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-1">Most Active Companies</h3>
              <p className="text-xs text-muted-foreground mb-3">Top companies by platform usage</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Projects</TableHead>
                    <TableHead className="text-xs">Photos</TableHead>
                    <TableHead className="text-xs">PDFs</TableHead>
                    <TableHead className="text-xs">Messages</TableHead>
                    <TableHead className="text-xs">Last Active</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.companyActivity || []).map((c: any) => (

                    <TableRow key={c.name}>
                      <TableCell className="text-xs font-medium text-card-foreground">{c.name}</TableCell>
                      <TableCell className="text-xs">{c.projects}</TableCell>
                      <TableCell className="text-xs">{c.team}</TableCell>
                      <TableCell className="text-xs font-bold text-primary">{c.photos}</TableCell>
                      <TableCell className="text-xs font-bold text-info">{c.pdfs}</TableCell>
                      <TableCell className="text-xs">{c.messages.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.lastActive}</TableCell>
                      <TableCell>
                        <Badge variant={c.plan === "Free" ? "secondary" : "default"} className="text-[10px]">
                          {c.plan}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 7. Freemium Conversion Opportunities */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-1">🔥 Conversion Opportunities</h3>
              <p className="text-xs text-muted-foreground mb-3">High-usage freemium companies ready for upgrade</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Projects</TableHead>
                    <TableHead className="text-xs">Drawings</TableHead>
                    <TableHead className="text-xs">Team</TableHead>
                    <TableHead className="text-xs">Days Left</TableHead>
                    <TableHead className="text-xs">Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.conversionOpportunities || []).map((c: any) => (

                    <TableRow key={c.name}>
                      <TableCell className="text-xs font-medium text-card-foreground">{c.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.phone}</TableCell>
                      <TableCell className="text-xs">{c.projects}</TableCell>
                      <TableCell className="text-xs">{c.drawings}</TableCell>
                      <TableCell className="text-xs">{c.teamSize}</TableCell>
                      <TableCell>
                        <Badge variant={c.daysLeft <= 10 ? "destructive" : "secondary"} className="text-[10px]">
                          {c.daysLeft} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-[10px]"
                          variant={c.activity === "High" ? "default" : "secondary"}
                        >
                          {c.activity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Right 4 cols */}
          <div className="col-span-4 space-y-4">
            {/* Revenue Snapshot */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Revenue Snapshot</h3>
              <div className="space-y-3">
                {[
                  { label: "MRR", value: "₹" + Number(dashboardStats?.mrr?.total ?? 0).toLocaleString() },
                  { label: "ARR", value: "₹" + Number(dashboardStats?.arr?.total ?? 0).toLocaleString() },
                  { label: "ARPU", value: "₹" + Number(dashboardStats?.arpu ?? 0).toLocaleString() },
                  { label: "MoM Growth", value: dashboardStats?.mrr?.text || "0%" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span className="text-sm font-bold font-display text-card-foreground">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Platform Activity Feed */}
            {/* <div className="bg-card rounded border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <h3 className="text-sm font-semibold text-card-foreground">Platform Activity</h3>
              </div>
              <div className="space-y-0 max-h-[420px] overflow-y-auto">
                {activityFeed.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                    <a.icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-card-foreground leading-relaxed">{a.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div> */}

            {/* Quick Stats */}
            <div className="bg-card rounded border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Conversion Metrics</h3>
              <div className="space-y-3">
                {(data?.saasPerformance || [
                  { label: "Free → Paid Rate", value: "0%", color: "bg-success" },
                  { label: "Trial Completion Rate", value: "0%", color: "bg-primary" },
                  { label: "Churn Rate", value: "0%", color: "bg-destructive" },
                ]).map((m: any) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                      <span className="text-xs font-bold text-card-foreground">{m.value}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.color}`} style={{ width: m.value.replace('%', '') + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SaasGrowthDashboard;
