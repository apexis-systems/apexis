"use client";

import { Bell, Search, Sun, Moon, LogOut, HelpCircle, MessageSquarePlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInterface } from '@/contexts/InterfaceContext';
import HelpSupportDialog from '@/components/shared/HelpSupportDialog';
import FeedbackDialog from '@/components/shared/FeedbackDialog';
import LanguageSelector from '@/components/shared/LanguageSelector';

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
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showSearch]);

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
            {/* Animated Search Bar */}
            <div className={`flex items-center overflow-hidden rounded-lg border transition-all duration-300 ease-in-out ${showSearch
                ? 'w-56 border-accent bg-secondary px-2'
                : 'w-8 border-transparent'
              }`}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="shrink-0 rounded-md p-1.5 hover:bg-secondary transition-colors"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
              </button>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
                placeholder="Search..."
                className={`flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-300 ${showSearch ? 'w-full opacity-100' : 'w-0 opacity-0 pointer-events-none'
                  }`}
              />
              {showSearch && (
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button onClick={() => setIsDark(!isDark)} className="rounded-lg p-2 hover:bg-secondary transition-colors">
              {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="rounded-lg p-2 hover:bg-secondary transition-colors"
              title="Help & Support"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowFeedback(true)}
              className="rounded-lg p-2 hover:bg-secondary transition-colors"
              title="Give Feedback"
            >
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            </button>
            <LanguageSelector />
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

      <HelpSupportDialog open={showHelp} onOpenChange={setShowHelp} />
      <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} />
    </>
  );
};

export default SiteHeader;
