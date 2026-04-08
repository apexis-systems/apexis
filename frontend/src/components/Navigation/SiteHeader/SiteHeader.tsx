"use client";

import { Bell, Search, Sun, Moon, LogOut, HelpCircle, MessageSquarePlus, MessageSquare, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInterface } from '@/contexts/InterfaceContext';
import { useSocket } from '@/contexts/SocketContext';
import HelpSupportDialog from '@/components/shared/HelpSupportDialog';
import FeedbackDialog from '@/components/shared/FeedbackDialog';
import LanguageSelector from '@/components/shared/LanguageSelector';
import NotificationDropdown from '../NotificationDropdown';

const SiteHeader = () => {
  const router = useRouter();
  const { user, logout } = useAuth() || {};
  const { setMode } = useInterface() || {};
  const { unreadChatCount } = useSocket();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('user-theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      // Always default to light for first-time users as requested
      setIsDark(false);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('user-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('user-theme', 'light');
    }
  }, [isDark, mounted]);

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src="/app-icon.png" alt="APEXIS" className="h-full w-full object-cover" />
            </div>
            <span className="text-base font-bold text-accent font-angelica tracking-wider">APEXIS</span>

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
            <button
              onClick={() => router.push(`/${user?.role || 'admin'}/chats`)}
              className="relative rounded-lg p-2 hover:bg-secondary transition-colors"
              title="Chats"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-card" />
              )}
            </button>
            <NotificationDropdown />

            {user && (
              <div className="ml-2 flex items-center gap-3 border-l border-border pl-4">
                <button
                  type="button"
                  onClick={() => router.push(`/${user?.role || 'admin'}/profile`)}
                  className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="text-xs font-semibold text-foreground">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground">{user.email || user.phone_number || user.role}</div>
                </button>
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
