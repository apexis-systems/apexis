"use client";

import { useMemo, useState, useEffect } from "react";
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
import { getFreemiumLeads } from "@/services/superadminService";

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
  const [loading, setLoading] = useState(true);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await getFreemiumLeads();
        setLeadsList(response.leads || []);
      } catch (error) {
        console.error("Failed to fetch leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  const filtered = useMemo(() => {
    return leadsList.filter((lead) => {
      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        lead.name?.toLowerCase().includes(query) ||
        lead.company?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query);

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
  }, [activeFilter, expiryFilter, search, statusFilter, leadsList]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Clock className="h-8 w-8 animate-spin text-[hsl(24_95%_53%)]" />
          <p className={cn("text-sm font-medium", mutedTextClass)}>Loading lead intelligence...</p>
        </div>
      </div>
    );
  }

  const totalFreemium = leadsList.length;
  const expiring15 = leadsList.filter((lead) => lead.remaining <= 15).length;
  const expiring7 = leadsList.filter((lead) => lead.remaining <= 7).length;
  const converted = leadsList.filter((lead) => lead.converted).length;

  const summaryCards = [
    { title: "Total Freemium Users", value: totalFreemium, icon: Users, accent: "bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)]" },
    { title: "Expiring in 15 Days", value: expiring15, icon: Clock, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { title: "Expiring in 7 Days", value: expiring7, icon: AlertTriangle, accent: "bg-red-500/10 text-red-600 dark:text-red-400" },
    { title: "Converted to Paid", value: converted, icon: CreditCard, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ];

  const remindableLeads = leadsList.filter((lead) => getReminders(lead.remaining).length > 0);

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
            Showing {filtered.length} of {leadsList.length} leads
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
