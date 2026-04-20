"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SuperadminSidebar, {
  SUPERADMIN_DASHBOARD_PATH,
  type SuperadminNavItem,
  superadminNavItems,
} from "@/components/superadmin/SuperadminSidebar";
import SuperadminThemeToggle from "@/components/superadmin/SuperadminThemeToggle";
import { cn } from "@/lib/utils";

interface SuperadminLayoutProps {
  children: ReactNode;
}

export default function SuperadminLayout({
  children,
}: SuperadminLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "superadmin") {
      router.replace(`/${user.role}/dashboard`);
    }
  }, [isLoading, router, user]);

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

  const handleMobileNavigation = (item: SuperadminNavItem) => {
    if (item.scrollTo) {
      if (pathname !== SUPERADMIN_DASHBOARD_PATH) {
        router.push(item.href);
        return;
      }

      document
        .getElementById(item.scrollTo)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", item.href);
      setActiveHash(item.scrollTo);
      return;
    }

    router.push(item.href);
  };

  if (isLoading || !user || user.role !== "superadmin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading superadmin workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(38_33%_95%)] text-[hsl(30_10%_15%)] dark:bg-[hsl(30_10%_10%)] dark:text-[hsl(38_20%_90%)]">
      <SuperadminSidebar />

      <div className="md:hidden">
        <div className="sticky top-0 z-40 border-b border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)]/95 px-4 py-4 backdrop-blur dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]/95">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/superadmin/dashboard")}
              className="flex items-center gap-3 text-left">
              <Image
                src="/app-icon.png"
                alt="Apexis Logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md"
              />
              <div>
                <div className="text-base font-bold text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]">
                  <span className="font-angelica text-[hsl(24_95%_53%)]">Apexis</span>
                  <span className="ml-2 text-xs font-normal uppercase tracking-[0.2em] text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]">
                    Superadmin
                  </span>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <SuperadminThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] text-[hsl(30_8%_45%)] shadow-sm transition-colors hover:bg-[hsl(37_18%_91%)] hover:text-[hsl(30_10%_15%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] dark:text-[hsl(38_10%_55%)] dark:hover:bg-[hsl(30_6%_18%)] dark:hover:text-[hsl(38_20%_90%)]">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {superadminNavItems.map((item) => {
              const isActive = item.scrollTo
                ? pathname === SUPERADMIN_DASHBOARD_PATH &&
                  activeHash === item.scrollTo
                : item.href === SUPERADMIN_DASHBOARD_PATH
                  ? pathname === SUPERADMIN_DASHBOARD_PATH && !activeHash
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleMobileNavigation(item)}
                  className={cn(
                    "rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                    isActive
                      ? "bg-[hsl(24_95%_53%)] text-white"
                      : "bg-[hsl(37_18%_91%)] text-[hsl(30_8%_45%)] dark:bg-[hsl(30_6%_18%)] dark:text-[hsl(38_10%_55%)]",
                  )}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SuperadminThemeToggle className="fixed right-6 top-4 z-50 hidden md:flex" />

      <main className="min-h-screen md:pl-60">{children}</main>
    </div>
  );
}
