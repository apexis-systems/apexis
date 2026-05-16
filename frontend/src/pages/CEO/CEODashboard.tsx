'use client'
import { useRef, useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar/DashboardSidebar";
import KPICards from "./KPICards/KPICards";
import PlatformGrowth from "./PlatformGrowth/PlatformGrowth";
import ProjectActivity from "./ProjectActivity/ProjectActivity";
import CommunicationAnalytics from "./CommunicationAnalytics/CommunicationAnalytics";
import ProjectHealth from "./ProjectHealth/ProjectHealth";
import CompanyUsage from "./CompanyUsage/CompanyUsage";
import RevenueAnalytics from "./RevenueAnalytics/RevenueAnalytics";
import FeatureUsage from "./FeatureUsage/FeatureUsage";
import SystemHealth from "./SystemHealth/SystemHealth";
import UserBehavior from "./UserBehavior/UserBehavior";
import AlertsPanel from "./AlertsPanel/AlertsPanel";
import IntelligencePanel from "./IntelligencePanel/IntelligencePanel";
import LiveActivityFeed from "./LiveActivityFeed/LiveActivityFeed";

const sectionIds = ["overview", "growth", "activity", "communication", "health", "companies", "revenue", "features", "system", "behavior"];

const CEODashboard = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle("dark", dark);
    }
  }, [dark, mounted]);

  if (!mounted) return null;

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    refs.current[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar active={activeSection} onNavigate={handleNavigate} />

      {/* Main Content */}
      <div className="flex-1 flex">
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">CEO Command Center</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Real-time platform overview · March 2026</p>
            </div>
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
            </button>
          </div>

          {/* Big 8 KPIs */}
          <div ref={(el) => { refs.current["overview"] = el; }}>
            <KPICards />
          </div>

          <div ref={(el) => { refs.current["growth"] = el; }}>
            <PlatformGrowth />
          </div>

          <div ref={(el) => { refs.current["activity"] = el; }}>
            <ProjectActivity />
          </div>

          <div ref={(el) => { refs.current["communication"] = el; }}>
            <CommunicationAnalytics />
          </div>

          <div ref={(el) => { refs.current["health"] = el; }}>
            <ProjectHealth />
          </div>

          <div ref={(el) => { refs.current["companies"] = el; }}>
            <CompanyUsage />
          </div>

          <div ref={(el) => { refs.current["revenue"] = el; }}>
            <RevenueAnalytics />
          </div>

          <div ref={(el) => { refs.current["features"] = el; }}>
            <FeatureUsage />
          </div>

          <div ref={(el) => { refs.current["system"] = el; }}>
            <SystemHealth />
          </div>

          <div ref={(el) => { refs.current["behavior"] = el; }}>
            <UserBehavior />
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 border-l border-border bg-card p-4 overflow-y-auto hidden xl:block space-y-6">
          <LiveActivityFeed />
          <AlertsPanel />
          <IntelligencePanel />
        </aside>
      </div>
    </div>
  );
};

export default CEODashboard;
