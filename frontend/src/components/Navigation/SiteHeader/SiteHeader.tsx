"use client";

import { Bell, Search, Sun, Moon, LogOut, HelpCircle, MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInterface } from '@/contexts/InterfaceContext';
// import HelpSupportDialog from '@/components/shared/HelpSupportDialog';
// import FeedbackDialog from '@/components/shared/FeedbackDialog';
// import LanguageSelector from '@/components/shared/LanguageSelector';

const SiteHeader = () => {
  const router = useRouter();
  const { user, logout } = useAuth() || {};
  const { setMode } = useInterface() || {};
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleLogout = () => {
    if (logout) logout();
    if (setMode) setMode(null);
    router.push('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-14 items-center justify-between px-6">
          <button onClick={() => router.push(`/${user?.role || 'admin'}/dashboard`)} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <span className="text-sm font-bold text-accent-foreground">A</span>
            </div>
            <span className="text-base font-bold text-foreground">Apexis</span>
          </button>

          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 hover:bg-secondary transition-colors">
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => setIsDark(!isDark)} className="rounded-lg p-2 hover:bg-secondary transition-colors">
              {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button className="rounded-lg p-2 hover:bg-secondary transition-colors">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="rounded-lg p-2 hover:bg-secondary transition-colors">
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            </button>
            {/* <LanguageSelector /> */}
            <button className="relative rounded-lg p-2 hover:bg-secondary transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
            </button>

            {user && (
              <div className="ml-2 flex items-center gap-3 border-l border-border pl-4">
                <div className="text-right">
                  <div className="text-xs font-semibold text-foreground">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{user.role}</div>
                </div>
                <button onClick={handleLogout} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* <HelpSupportDialog open={showHelp} onOpenChange={setShowHelp} /> */}
      {/* <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} /> */}
    </>
  );
};

export default SiteHeader;
