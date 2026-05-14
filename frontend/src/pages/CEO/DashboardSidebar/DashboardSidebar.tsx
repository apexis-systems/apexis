"use client";

import { BarChart3, Building2, FolderKanban, MessageSquare, HeartPulse, DollarSign, Zap, Monitor, Users, Bell, LayoutDashboard } from "lucide-react";
import Image from "next/image";

interface Props {
  active: string;
  onNavigate: (section: string) => void;
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "growth", label: "Platform Growth", icon: BarChart3 },
  { id: "activity", label: "Project Activity", icon: FolderKanban },
  { id: "communication", label: "Communication", icon: MessageSquare },
  { id: "health", label: "Project Health", icon: HeartPulse },
  { id: "companies", label: "Company Usage", icon: Building2 },
  { id: "revenue", label: "Revenue", icon: DollarSign },
  { id: "features", label: "Feature Usage", icon: Zap },
  { id: "system", label: "System Health", icon: Monitor },
  { id: "behavior", label: "User Behavior", icon: Users },
];

const DashboardSidebar = ({ active, onNavigate }: Props) => (
  <aside className="w-56 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 h-screen sticky top-0">
    <div className="p-4 border-b border-sidebar-border flex items-center gap-2.5">
      <Image 
        src="/app-icon.png" 
        alt="Apexis Logo" 
        width={32} 
        height={32} 
        className="h-8 w-8 rounded-md" 
      />
      <div>
        <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Angelica, sans-serif', color: '#f97415' }}>APEXIS</h1>
        <p className="text-[10px] font-medium text-sidebar-muted uppercase tracking-widest mt-0.5">CEO Command Center</p>
      </div>
    </div>
    <nav className="flex-1 py-2 px-2 space-y-0.5">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            active === item.id
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-foreground">
          CEO
        </div>
        <div>
          <p className="text-xs font-medium text-sidebar-foreground">Admin</p>
          <p className="text-[10px] text-sidebar-muted">ceo@apexis.in</p>
        </div>
      </div>
    </div>
  </aside>
);

export default DashboardSidebar;
