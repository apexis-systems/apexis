"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  installDate: string;
  trialStart: string;
  trialEnd: string;
  remaining: number;
  daysUsed: number;
  activityScore: number;
  isActive: boolean;
  converted: boolean;
}

const leads: Lead[] = [
  { id: 1, name: "Rahul Sharma", email: "rahul@abcdev.com", phone: "+91 9876543210", company: "ABC Developers", installDate: "2026-02-10", trialStart: "2026-02-11", trialEnd: "2026-04-12", remaining: 5, daysUsed: 55, activityScore: 82, isActive: true, converted: false },
  { id: 2, name: "Priya Patel", email: "priya@xyzcon.com", phone: "+91 9123456789", company: "XYZ Constructions", installDate: "2026-01-31", trialStart: "2026-02-01", trialEnd: "2026-04-02", remaining: 15, daysUsed: 45, activityScore: 45, isActive: true, converted: false },
  { id: 3, name: "Arjun Mehta", email: "arjun@studioarch.com", phone: "+91 9988776655", company: "Studio Architects", installDate: "2026-01-18", trialStart: "2026-01-19", trialEnd: "2026-03-20", remaining: 0, daysUsed: 58, activityScore: 91, isActive: true, converted: false },
  { id: 4, name: "Sneha Reddy", email: "sneha@greeninfra.com", phone: "+91 9012345678", company: "Green Infrastructure", installDate: "2026-03-10", trialStart: "2026-03-11", trialEnd: "2026-05-10", remaining: 35, daysUsed: 25, activityScore: 67, isActive: true, converted: false },
  { id: 5, name: "Vikram Singh", email: "vikram@buildit.com", phone: "+91 9345678901", company: "BuildIt Corp", installDate: "2026-03-20", trialStart: "2026-03-21", trialEnd: "2026-05-20", remaining: 42, daysUsed: 18, activityScore: 23, isActive: true, converted: false },
  { id: 6, name: "Ananya Gupta", email: "ananya@skyline.com", phone: "+91 9567890123", company: "Skyline Projects", installDate: "2026-02-24", trialStart: "2026-02-25", trialEnd: "2026-04-26", remaining: 18, daysUsed: 42, activityScore: 78, isActive: true, converted: false },
  { id: 7, name: "Karan Joshi", email: "karan@metrocon.com", phone: "+91 9234567890", company: "Metro Constructions", installDate: "2026-03-05", trialStart: "2026-03-06", trialEnd: "2026-05-05", remaining: 28, daysUsed: 32, activityScore: 55, isActive: true, converted: false },
  { id: 8, name: "Divya Nair", email: "divya@urbanplan.com", phone: "+91 9678901234", company: "Urban Planners", installDate: "2026-03-26", trialStart: "2026-03-27", trialEnd: "2026-05-26", remaining: 48, daysUsed: 12, activityScore: 12, isActive: false, converted: false },
  { id: 9, name: "Aditya Kumar", email: "aditya@primebuild.com", phone: "+91 9456789012", company: "Prime Builders", installDate: "2026-02-14", trialStart: "2026-02-15", trialEnd: "2026-04-16", remaining: 12, daysUsed: 48, activityScore: 88, isActive: true, converted: false },
  { id: 10, name: "Meera Iyer", email: "meera@apexstruct.com", phone: "+91 9789012345", company: "Apex Structures", installDate: "2026-03-30", trialStart: "2026-03-31", trialEnd: "2026-05-30", remaining: 52, daysUsed: 8, activityScore: 70, isActive: true, converted: false },
  { id: 11, name: "Rohan Das", email: "rohan@novaeng.com", phone: "+91 9890123456", company: "", installDate: "2026-03-14", trialStart: "2026-03-15", trialEnd: "2026-05-14", remaining: 24, daysUsed: 22, activityScore: 34, isActive: true, converted: false },
  { id: 12, name: "Simran Kaur", email: "simran@topcon.com", phone: "+91 9321654987", company: "TopCon Builders", installDate: "2026-02-20", trialStart: "2026-02-21", trialEnd: "2026-04-22", remaining: 8, daysUsed: 52, activityScore: 60, isActive: true, converted: false },
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
  "border-b border-[hsl(35_15%_85%/0.6)] px-4 py-3 text-xs dark:border-[hsl(30_8%_22%/0.6)]";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getStatusTag = (remaining: number) => {
  if (remaining <= 15) {
    return {
      label: "Conversion Window",
      color:
        "bg-red-500/15 text-red-600 border-red-500/20 dark:text-red-400",
      emoji: "🔴",
    };
  }
  if (remaining <= 30) {
    return {
      label: "Warm Lead",
      color:
        "bg-amber-500/15 text-amber-600 border-amber-500/20 dark:text-amber-400",
      emoji: "🟡",
    };
  }
  return {
    label: "New User",
    color:
      "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    emoji: "🟢",
  };
};

const getConversionProbability = (score: number) => {
  if (score >= 70) return { label: "High", color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 40) return { label: "Medium", color: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { label: "Low", color: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
};

const getReminders = (remaining: number) => {
  const reminders: string[] = [];
  if (remaining <= 30 && remaining > 15) reminders.push("First follow-up reminder");
  if (remaining <= 15 && remaining > 5) reminders.push("Conversion reminder");
  if (remaining <= 5) reminders.push("Last reminder before trial ends");
  return reminders;
};

export default function FreemiumLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        lead.name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (statusFilter === "new" && lead.remaining < 30) return false;
      if (statusFilter === "warm" && (lead.remaining >= 30 || lead.remaining < 15)) return false;
      if (statusFilter === "conversion" && lead.remaining >= 15) return false;
      if (activeFilter === "active" && !lead.isActive) return false;
      if (activeFilter === "inactive" && lead.isActive) return false;
      if (expiryFilter === "15" && lead.remaining > 15) return false;
      if (expiryFilter === "7" && lead.remaining > 7) return false;

      return true;
    });
  }, [activeFilter, expiryFilter, search, statusFilter]);

  const totalFreemium = leads.length;
  const expiring15 = leads.filter((lead) => lead.remaining <= 15).length;
  const expiring7 = leads.filter((lead) => lead.remaining <= 7).length;
  const converted = leads.filter((lead) => lead.converted).length;

  const summaryCards = [
    { title: "Total Freemium Users", value: totalFreemium, icon: Users, accent: "bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]" },
    { title: "Expiring in 15 Days", value: expiring15, icon: Clock, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { title: "Expiring in 7 Days", value: expiring7, icon: AlertTriangle, accent: "bg-red-500/10 text-red-600 dark:text-red-400" },
    { title: "Converted to Paid", value: converted, icon: CreditCard, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ];

  const remindableLeads = leads.filter((lead) => getReminders(lead.remaining).length > 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className={cn("text-xl font-bold", strongTextClass)}>Freemium Leads</h1>
        <p className={cn("mt-0.5 text-xs", mutedTextClass)}>
          Track & convert free trial users into paid subscribers
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.title} className={cn(cardClass, "p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded", card.accent)}>
                <card.icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn("text-xs font-medium uppercase tracking-wide", mutedTextClass)}>
                {card.title}
              </span>
            </div>
            <div className={cn("text-2xl font-bold", strongTextClass)}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className={cn(cardClass, "p-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", mutedTextClass)} />
            <Input
              placeholder="Search by name, email, company..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New User</SelectItem>
              <SelectItem value="warm">Warm Lead</SelectItem>
              <SelectItem value="conversion">Conversion Window</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={expiryFilter} onValueChange={setExpiryFilter}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Expiry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Expiry</SelectItem>
              <SelectItem value="15">Expiring in 15 days</SelectItem>
              <SelectItem value="7">Expiring in 7 days</SelectItem>
            </SelectContent>
          </Select>

          <div className={cn("ml-auto text-xs", mutedTextClass)}>
            Showing {filtered.length} of {leads.length} leads
          </div>
        </div>
      </div>

      {remindableLeads.length > 0 ? (
        <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", strongTextClass)}>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Lead Reminders ({remindableLeads.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {remindableLeads.slice(0, 6).map((lead) => (
              <div key={lead.id} className={cn(cardClass, "flex items-center gap-2 p-2")}>
                <span className={cn("truncate text-xs font-medium", strongTextClass)}>
                  {lead.name}
                </span>
                <span className={mutedTextClass}>·</span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {getReminders(lead.remaining)[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn(cardClass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[hsl(37_18%_91%/0.45)] dark:bg-[hsl(30_6%_18%/0.9)]">
              <tr>
                <th className={tableHeadClass}>User</th>
                <th className={tableHeadClass}>Company</th>
                <th className={tableHeadClass}>Trial Period</th>
                <th className={cn(tableHeadClass, "text-center")}>Days Left</th>
                <th className={tableHeadClass}>Status</th>
                <th className={tableHeadClass}>Conversion Score</th>
                <th className={cn(tableHeadClass, "text-center")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const status = getStatusTag(lead.remaining);
                const probability = getConversionProbability(lead.activityScore);

                return (
                  <tr key={lead.id}>
                    <td className={tableCellClass}>
                      <div>
                        <div className={cn("text-sm font-medium", strongTextClass)}>{lead.name}</div>
                        <div className={cn("text-xs", mutedTextClass)}>{lead.email}</div>
                        <div className={cn("text-xs", mutedTextClass)}>{lead.phone}</div>
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <span className={cn("text-sm", strongTextClass)}>{lead.company || "—"}</span>
                    </td>
                    <td className={tableCellClass}>
                      <div className={cn("space-y-0.5 text-xs", mutedTextClass)}>
                        <div>Installed: {formatDate(lead.installDate)}</div>
                        <div>Start: {formatDate(lead.trialStart)}</div>
                        <div>Expires: {formatDate(lead.trialEnd)}</div>
                      </div>
                    </td>
                    <td className={cn(tableCellClass, "text-center")}>
                      <span
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                          lead.remaining <= 10
                            ? "bg-red-500/15 text-red-600 dark:text-red-400"
                            : lead.remaining <= 20
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        )}>
                        {lead.remaining}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider", status.color)}>
                        {status.emoji} {status.label}
                      </span>
                      {getReminders(lead.remaining).length > 0 ? (
                        <div className="mt-1">
                          {getReminders(lead.remaining).map((reminder) => (
                            <div key={reminder} className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              ⏰ {reminder}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className={tableCellClass}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[hsl(37_18%_91%)] dark:bg-[hsl(30_6%_18%)]">
                            <div className={cn("h-full rounded-full", probability.bar)} style={{ width: `${lead.activityScore}%` }} />
                          </div>
                          <span className={cn("text-xs font-semibold", probability.color)}>
                            {probability.label}
                          </span>
                        </div>
                        <div className={cn("text-[10px]", mutedTextClass)}>Activity: {lead.activityScore}%</div>
                      </div>
                    </td>
                    <td className={cn(tableCellClass, "text-center")}>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(30_8%_45%)] hover:text-[hsl(24_95%_53%)]" title="Send Email">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(30_8%_45%)] hover:text-emerald-600 dark:hover:text-emerald-400" title="Call User">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(30_8%_45%)] hover:text-sky-500" title="WhatsApp Message">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={cn("py-8 text-center text-sm", mutedTextClass)}>
                    No leads match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
