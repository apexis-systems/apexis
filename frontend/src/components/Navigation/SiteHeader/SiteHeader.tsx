"use client";

import { Bell, Search, Sun, Moon, LogOut, HelpCircle, MessageSquarePlus, MessageSquare, X, Shield, Briefcase, Loader2, User, Folder, FileText, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInterface } from '@/contexts/InterfaceContext';
import { useSocket } from '@/contexts/SocketContext';
import HelpSupportDialog from '@/components/shared/HelpSupportDialog';
import FeedbackDialog from '@/components/shared/FeedbackDialog';
import LanguageSelector from '@/components/shared/LanguageSelector';
import NotificationDropdown from '../NotificationDropdown';
import { switchContext } from '@/services/authService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { globalSearch } from '@/services/searchService';

const SiteHeader = () => {
  const router = useRouter();
  const { user, logout, login } = useAuth() || {};
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const { setMode } = useInterface() || {};
  const { unreadChatCount } = useSocket();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await globalSearch(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <span className="text-base font-bold font-angelica tracking-wider flex items-center">
              <span className="text-primary">APEXIS<span className="text-[10px] uppercase">PRO™</span></span>
            </span>

          </button>

          <div className="flex items-center gap-2">
            <div ref={searchContainerRef} className="relative">
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
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1" />}
                {showSearch && (
                  <button
                    onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults(null); }}
                    className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults && (
                <div className="absolute top-full right-0 mt-2 w-80 max-h-[400px] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 no-scrollbar">
                  {Object.values(searchResults).every((arr: any) => arr.length === 0) ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No results found for "{searchQuery}"
                    </div>
                  ) : (
                    <>
                      {searchResults.projects?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projects</div>
                          {searchResults.projects.map((project: any) => (
                            <button
                              key={project.id}
                              onClick={() => {
                                router.push(`/${user?.role || 'admin'}/project/${project.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {project.name.charAt(0)}
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-semibold truncate text-foreground">{project.name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{project.description || 'No description'}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.folders?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Folders</div>
                          {searchResults.folders.map((folder: any) => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                const tab = folder.folder_type === 'photo' ? 'photos' : 'documents';
                                router.push(`/${user?.role || 'admin'}/project/${folder.project_id}?tab=${tab}&folder=${folder.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-accent/10 flex items-center justify-center text-accent">
                                <Folder className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-semibold truncate text-foreground">{folder.name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {folder.project?.name && `In: ${folder.project.name} • `}{folder.folder_type}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.docs?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Documents</div>
                          {searchResults.docs.map((doc: any) => (
                            <button
                              key={doc.id}
                              onClick={() => {
                                router.push(`/${user?.role || 'admin'}/project/${doc.project_id}?tab=documents&folder=${doc.folder_id || ''}&fileId=${doc.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium truncate text-foreground">{doc.file_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {doc.project?.name ? `In: ${doc.project.name}` : doc.file_type}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.photos?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Photos</div>
                          {searchResults.photos.map((photo: any) => (
                            <button
                              key={photo.id}
                              onClick={() => {
                                router.push(`/${user?.role || 'admin'}/project/${photo.project_id}?tab=photos&folder=${photo.folder_id || ''}&photoId=${photo.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-green-500/10 flex items-center justify-center text-green-500">
                                <Camera className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium truncate text-foreground">{photo.file_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {photo.project?.name ? `In: ${photo.project.name}` : 'Image'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {searchResults.snags?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Snags</div>
                          {searchResults.snags.map((snag: any) => (
                            <button
                              key={snag.id}
                              onClick={() => {
                                router.push(`/${user?.role || 'admin'}/project/${snag.project_id}?tab=snags&snagId=${snag.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-semibold truncate text-foreground">{snag.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {snag.project?.name ? `In: ${snag.project.name}` : (snag.description || 'No description')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.rfis?.length > 0 && (
                        <div className="mb-4">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">RFI</div>
                          {searchResults.rfis.map((rfi: any) => (
                            <button
                              key={rfi.id}
                              onClick={() => {
                                router.push(`/${user?.role || 'admin'}/project/${rfi.project_id}?tab=rfi&rfiId=${rfi.id}`);
                                setSearchResults(null);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                            >
                              <div className="h-8 w-8 shrink-0 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <HelpCircle className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-semibold truncate text-foreground">{rfi.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {rfi.project?.name ? `In: ${rfi.project.name}` : (rfi.description || 'No description')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {Object.values(searchResults).every((arr: any) => !arr?.length) && (
                        <div className="py-12 text-center">
                          <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => window.location.reload()} className="rounded-lg p-2 hover:bg-secondary transition-colors" title="Refresh Page">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
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
              onClick={() => window.location.href = 'mailto:support@apexis.in'}
              className="rounded-lg p-2 hover:bg-secondary transition-colors"
              title="Give Feedback"
            >
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            </button>
            <LanguageSelector />
            
            {/* Global Role Switcher */}
            {user && (
              <div className="flex items-center gap-1.5 px-2 mr-2 border-x border-border">
                {[
                  { id: 'admin', label: 'Admin', icon: Shield },
                  { id: 'contributor', label: 'Contributor', icon: User },
                  { id: 'client', label: 'Client', icon: Briefcase },
                ].map((role) => {
                  const isActive = user.role === role.id;
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={async () => {
                        if (isActive || isSwitching || !login) return;
                        setIsSwitching(role.id);
                        try {
                          const res = await switchContext({ role: role.id });
                          if (res.token) {
                            const loggedInUser = await login(res.token);
                            const nextRole = loggedInUser?.role || role.id;
                            router.push(`/${nextRole}/dashboard`);
                            toast.success(`Switched to ${role.label} role`);
                          }
                        } catch (err: any) {
                          toast.error(err?.response?.data?.error || "You do not have access to this role.");
                        } finally {
                          setIsSwitching(null);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
                        isActive 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-secondary/50 text-muted-foreground border-transparent hover:border-border hover:bg-secondary"
                      )}
                      disabled={!!isSwitching}
                    >
                      {isSwitching === role.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                      <span>{role.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

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
