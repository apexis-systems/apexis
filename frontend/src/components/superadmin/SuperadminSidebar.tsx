"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  DollarSign,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Rocket,
  Settings2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export interface SuperadminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  scrollTo?: string;
  badge?: number;
}

export const SUPERADMIN_DASHBOARD_PATH = "/superadmin/dashboard";

export const superadminNavItems: SuperadminNavItem[] = [
  { href: SUPERADMIN_DASHBOARD_PATH, label: "Overview", icon: LayoutDashboard },
  { href: "/superadmin/saas-growth", label: "SaaS Growth", icon: Rocket },
  { href: "/superadmin/freemium-leads", label: "Freemium Leads", icon: UserCheck },
  { href: "/superadmin/accounts", label: "Accounts", icon: IndianRupee },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#platform-growth`, label: "Platform Growth", icon: TrendingUp, scrollTo: "platform-growth" },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#project-activity`, label: "Project Activity", icon: ClipboardList, scrollTo: "project-activity" },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#communication`, label: "Communication", icon: MessageSquare, scrollTo: "communication" },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#feature-usage`, label: "Feature Usage", icon: BarChart3, scrollTo: "feature-usage" },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#revenue`, label: "Revenue", icon: DollarSign, scrollTo: "revenue" },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#alerts`, label: "Alerts", icon: AlertTriangle, scrollTo: "alerts", badge: 4 },
  { href: `${SUPERADMIN_DASHBOARD_PATH}#live-activity`, label: "Live Activity", icon: Activity, scrollTo: "live-activity" },
  { href: "/superadmin/teams", label: "Teams", icon: ShieldCheck },
];

const isPrimarySuperadmin = (value?: boolean | null) =>
  value === true;

export default function SuperadminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncHash = () => {
      setActiveHash(window.location.hash.replace("#", ""));
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleNavigation = (item: SuperadminNavItem) => {
    if (item.scrollTo) {
      if (pathname !== SUPERADMIN_DASHBOARD_PATH) {
        router.push(item.href);
        return;
      }

      document.getElementById(item.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", item.href);
      setActiveHash(item.scrollTo);
      return;
    }

    router.push(item.href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[hsl(30_8%_20%)] bg-[hsl(30_10%_12%)] text-[hsl(38_20%_85%)] md:flex dark:border-[hsl(30_8%_16%)] dark:bg-[hsl(30_10%_8%)]">
      <div className="flex items-center gap-3 border-b border-[hsl(30_8%_20%)] px-5 py-5 dark:border-[hsl(30_8%_16%)]">
        <Image
          src="/app-icon.png"
          alt="Apexis Logo"
          width={32}
          height={32}
          className="h-8 w-8 rounded-md"
        />
        <div>
          <h1 className="text-xl font-bold text-[hsl(38_20%_85%)]">
            <span className="font-angelica text-[hsl(24_95%_53%)]">Apexis</span>
            <span className="ml-2 text-sm font-normal text-[hsl(38_20%_85%/0.6)]">
              Admin
            </span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[hsl(38_20%_85%/0.45)]">
            Superadmin
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {superadminNavItems.map((item) => {
          const isActive = item.scrollTo
            ? pathname === SUPERADMIN_DASHBOARD_PATH && activeHash === item.scrollTo
            : item.href === SUPERADMIN_DASHBOARD_PATH
              ? pathname === SUPERADMIN_DASHBOARD_PATH && !activeHash
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavigation(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-[hsl(30_8%_18%)] text-[hsl(24_95%_53%)]"
                  : "text-[hsl(38_20%_85%/0.7)] hover:bg-[hsl(30_8%_18%)] hover:text-[hsl(38_20%_85%)]",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.label}</span>
              {item.badge ? (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-[hsl(30_8%_20%)] px-4 py-4 dark:border-[hsl(30_8%_16%)]">
        {user && (
          <div className="rounded-lg border border-[hsl(30_8%_20%)] bg-[hsl(30_8%_18%)]/50 px-3 py-3 dark:border-[hsl(30_8%_16%)]">
            <p className="text-sm font-semibold text-[hsl(38_20%_90%)]">{user.name}</p>
            <p className="mt-1 truncate text-xs text-[hsl(38_20%_85%/0.6)]">{user.email}</p>
            <div className="mt-3 inline-flex rounded-full border border-[hsl(24_95%_53%/0.25)] bg-[hsl(24_95%_53%/0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(24_95%_53%)]">
              {isPrimarySuperadmin(user.is_primary ?? user.isPrimaryAdmin)
                ? "Primary"
                : "Secondary"}
            </div>
          </div>
        )}

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-[hsl(38_20%_85%/0.6)] transition-colors duration-150 hover:bg-[hsl(30_8%_18%)] hover:text-[hsl(38_20%_85%)]"
        >
          <Settings2 className="h-[18px] w-[18px]" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-[hsl(38_20%_85%/0.6)] transition-colors duration-150 hover:bg-[hsl(30_8%_18%)] hover:text-[hsl(38_20%_85%)]"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
