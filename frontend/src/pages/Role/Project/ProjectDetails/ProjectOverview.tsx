"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { CalendarDays, FileText, Camera, Download, Clock, Loader2, Copy, Check, Pencil, PlayCircle, Share2, CheckCircle2, BarChart3, ChevronRight, Mail, Phone, Trash2, UserPlus, Folder } from 'lucide-react';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportHandoverPackage, getLatestExport, getProjectShareLinks, getProjectMembers, removeProjectMember, updateProject } from '@/services/projectService';
import { useSocket } from '@/contexts/SocketContext';
import { getReports, Report } from '@/services/reportService';
import { getFiles, getSecureFileUrl } from '@/services/fileService';
import { getFolders } from '@/services/folderService';
import { inviteUser } from '@/services/userService';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';
import ShareDialog from '@/components/shared/ShareDialog';
import FolderPickerDialog from './FolderPickerDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/helpers/apiError';
import { useLanguage } from '@/contexts/LanguageContext';


interface ProjectOverviewProps {
  project: Project;
  userRole: UserRole;
  onProjectUpdate?: (updated: Project) => void;
  onTabChange?: (tab: 'documents' | 'photos' | 'reports' | 'snags') => void;
  onEditClick?: (field?: 'start_date' | 'end_date') => void;
}

const ProjectOverview = ({ project, userRole, onProjectUpdate, onTabChange, onEditClick }: ProjectOverviewProps) => {
  const { t } = useLanguage();
  if (!project) return <div className="p-4 text-center text-sm text-muted-foreground">{t('loading_overview')}</div>;
  const canManageMembers = userRole === 'admin' || userRole === 'superadmin';
  const isClient = userRole === 'client';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [photosCount, setPhotosCount] = useState<number>(0);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [counting, setCounting] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<any | null>(null);

  const [memberModalType, setMemberModalType] = useState<'contributor' | 'client' | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | number | null>(null);
  const [deleteMemberObj, setDeleteMemberObj] = useState<any | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'blockScope'>('confirm');

  // Consultant/Vendor Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'vendor'>('vendor');
  const [projectFolders, setProjectFolders] = useState<any[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<(string | number)[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  useEffect(() => {
    if (!memberModalType || !project?.id) return;
    setLoadingMembers(true);
    getProjectMembers(project.id)
      .then(async data => {
         const fetchedMembers = data.members.filter((m: any) => {
            if (memberModalType === 'contributor') {
               return m.role === 'contributor' || m.role === 'consultant' || m.role === 'vendor';
            }
            return m.role === memberModalType;
         });
         const membersWithPics = await Promise.all(fetchedMembers.map(async (m: any) => {
            if (m.user.profile_pic) {
                try {
                   const url = await getSecureFileUrl(m.user.profile_pic);
                   return { ...m, secure_pic: url };
                } catch { return m; }
            }
            return m;
         }));
         setMembers(membersWithPics);
      })
      .catch((e) => toast.error("Failed to load members"))
      .finally(() => setLoadingMembers(false));
  }, [memberModalType, project?.id]);

  useEffect(() => {
    if (isInviteModalOpen && project?.id) {
      setLoadingFolders(true);
      getFolders(project.id)
        .then((data: any) => {
          setProjectFolders(Array.isArray(data) ? data : []);
          setSelectedFolders([]);
        })
        .catch((err) => {
          console.error("Failed to fetch folders", err);
          toast.error("Failed to load project folders");
        })
        .finally(() => setLoadingFolders(false));
    } else {
      setInviteEmail('');
      setInviteRole('vendor');
      setProjectFolders([]);
      setSelectedFolders([]);
      setGeneratedInviteUrl(null);
    }
  }, [isInviteModalOpen, project?.id]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = inviteEmail.trim();
    if (!inputVal) {
      toast.error("Please enter an email address or phone number");
      return;
    }

    const isEmail = inputVal.includes('@');
    let payload: any = {
      role: inviteRole,
      project_id: project.id,
      folders: selectedFolders
    };

    if (isEmail) {
      payload.email = inputVal;
    } else {
      // Clean non-numeric characters to extract digits
      const digits = inputVal.replace(/\D/g, "");
      if (digits.length === 10) {
        payload.phone_number = `+91${digits}`;
      } else if (digits.length > 10 && inputVal.startsWith("+")) {
        payload.phone_number = `+${digits}`;
      } else {
        toast.error("Please enter a valid email address or 10-digit phone number");
        return;
      }
    }

    try {
      setInviting(true);
      const res = await inviteUser(payload);
      toast.success("Vendor invited successfully");
      if (res.inviteUrl) {
        setGeneratedInviteUrl(res.inviteUrl);
      } else {
        setIsInviteModalOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to send invitation"));
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (member: any, block: boolean = false, blockScope?: 'project' | 'org') => {
    if (!project?.id || !member?.user?.id) return;
    try {
      setRemovingMemberId(member.user.id);
      await removeProjectMember(project.id, member.user.id, block, blockScope);
      toast.success(t('project_access_removed'));
      setDeleteMemberObj(null);
      setDeleteStep('confirm');
      const refreshed = await getProjectMembers(project.id);
      const fetchedMembers = refreshed.members.filter((m: any) => {
        if (memberModalType === 'contributor') {
          return m.role === 'contributor' || m.role === 'consultant' || m.role === 'vendor';
        }
        return m.role === memberModalType;
      });
      const membersWithPics = await Promise.all(fetchedMembers.map(async (m: any) => {
        if (m.user.profile_pic) {
          try {
            const url = await getSecureFileUrl(m.user.profile_pic);
            return { ...m, secure_pic: url };
          } catch { return m; }
        }
        return m;
      }));
      setMembers(membersWithPics);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, t('failed_remove_access')));
    } finally {
      setRemovingMemberId(null);
    }
  };


  // Export state
  const { socket } = useSocket();
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const [exportTimerMs, setExportTimerMs] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [latestExport, setLatestExport] = useState<{ url: string, date: string } | null>(null);

  // Load latest export
  useEffect(() => {
    if ((userRole !== 'admin' && userRole !== 'superadmin') || !project?.id) return;
    getLatestExport(project.id)
      .then(data => {
        if (data.downloadUrl) {
          setLatestExport({ url: data.downloadUrl, date: data.last_export_date });
        }
        if (data.activeExport) {
          setIsExporting(true);
          setExportStatusText(data.activeExport.statusText);
          if (data.activeExport.etaMs !== undefined) {
             setIsCountingDown(true);
             setExportTimerMs(data.activeExport.etaMs);
          } else {
             setIsCountingDown(false);
             setExportTimerMs(Date.now() - data.activeExport.startTime);
          }
        }
      })
      .catch(() => {});
  }, [project?.id, userRole]);

  // Socket listener for export progress
  useEffect(() => {
    if (!socket || (userRole !== 'admin' && userRole !== 'superadmin')) return;

    let timerInterval: NodeJS.Timeout;

    const handleExportStatus = (data: any) => {
      if (data.projectId !== project?.id) return;
      
      if (!isExporting && data.statusType === 'progress') {
        setIsExporting(true);
        setExportTimerMs(0);
        setIsCountingDown(false);
      }

      setExportStatusText(data.status);

      if (data.etaMs !== undefined) {
         setIsCountingDown(true);
         setExportTimerMs(data.etaMs);
      }

      if (data.statusType === 'success') {
        setIsExporting(false);
        setLatestExport({ url: data.presignedUrl, date: new Date().toISOString() });
        toast.success(t('export_completed').replace('{count}', String(Math.round(data.totalTimeMs / 1000))));
      } else if (data.statusType === 'failed') {
        setIsExporting(false);
        toast.error(t('export_failed').replace('{error}', data.status));
      }
    };

    socket.on('export-status', handleExportStatus);

    if (isExporting) {
       timerInterval = setInterval(() => {
         setExportTimerMs(prev => isCountingDown ? Math.max(0, prev - 1000) : prev + 1000);
       }, 1000);
    }

    return () => {
      socket.off('export-status', handleExportStatus);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [socket, isExporting, isCountingDown, project?.id, userRole]);

  // Real-time stat updates
  useEffect(() => {
    if (!socket || !project?.id) return;

    socket.emit('join-project', project.id);

    const handleStatsUpdate = (data: any) => {
      if (String(data.projectId) !== String(project.id)) return;
      setCounting(true);
      getFiles(project.id)
        .then((d) => {
          let photos = 0, docs = 0;
          if (d.fileData) {
            d.fileData.forEach((file: any) => {
              if (file.file_type?.startsWith('image/')) photos++;
              else docs++;
            });
          }
          setPhotosCount(photos);
          setDocsCount(docs);
        })
        .catch(() => {})
        .finally(() => setCounting(false));
    };

    socket.on('project-stats-updated', handleStatsUpdate);
    return () => { socket.off('project-stats-updated', handleStatsUpdate); };
  }, [socket, project?.id]);

  const handleStartExport = async () => {
    try {
      if (!project?.id) return;
      setIsExporting(true);
      setExportStatusText(t('starting_export'));
      setExportTimerMs(0);
      setIsCountingDown(false);
      await exportHandoverPackage(project.id);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, t('failed_trigger_export')));
      setIsExporting(false);
    }
  };

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!project?.id) return;
    getReports(project.id as any)
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));

    setCounting(true);
    getFiles(project.id)
      .then((data) => {
        let photos = 0, docs = 0;
        if (data.fileData) {
          data.fileData.forEach((file: any) => {
            if (file.file_type?.startsWith('image/')) photos++;
            else docs++;
          });
        }
        setPhotosCount(photos);
        setDocsCount(docs);
      })
      .catch(() => { })
      .finally(() => setCounting(false));
  }, [project?.id]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });


  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success(t('copied_to_clipboard'));
  };

  const handleShareLink = async (role: 'contributor' | 'client', code: string) => {
    try {
      const data = await getProjectShareLinks(project.id, role);
      const shareUrl = role === 'contributor' ? data.contributorLink : data.clientLink;
      setShareItem({
        file_name: `Project Access (${role === 'contributor' ? 'Contributor' : 'Client'})`,
        downloadUrl: shareUrl,
        role: role === 'contributor' ? 'contributor' : 'client'
      });
    } catch (e) {
      toast.error(t('failed_share_link'));
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Project Description moved to main header in Project.tsx */}


      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {!isClient && (
          <>
            <div 
              className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
              onClick={() => (userRole === 'admin' || userRole === 'superadmin') && onEditClick?.('start_date')}
            >
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-accent transition-colors">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs">{t('start_date')}</span>
              </div>
              <div className="mt-1 text-sm font-semibold">{project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}</div>
            </div>
            <div 
              className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
              onClick={() => (userRole === 'admin' || userRole === 'superadmin') && onEditClick?.('end_date')}
            >
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-accent transition-colors">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs">{t('end_date')}</span>
              </div>
              <div className="mt-1 text-sm font-semibold">{project.end_date ? new Date(project.end_date).toLocaleDateString() : '—'}</div>
            </div>
          </>
        )}
        <div 
          className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
          onClick={() => onTabChange?.('documents')}
        >
          <div className="flex items-center gap-2 text-accent group-hover:text-accent/80 transition-colors">
            <FileText className="h-4 w-4" />
            <span className="text-xs">{t('documents')}</span>
          </div>
          <div className="mt-1 text-xl font-bold text-accent">{counting ? '...' : docsCount}</div>
        </div>
        <div 
          className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
          onClick={() => onTabChange?.('photos')}
        >
          <div className="flex items-center gap-2 text-accent group-hover:text-accent/80 transition-colors">
            <Camera className="h-4 w-4" />
            <span className="text-xs">{t('photos')}</span>
          </div>
          <div className="mt-1 text-xl font-bold text-accent">{counting ? '...' : photosCount}</div>
        </div>
      </div>

      {isClient && (
        <>
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('client_project_code')}</div>
            <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
              <span className="font-mono text-sm font-bold text-foreground">{(project as any).client_code || '—'}</span>
              {(project as any).client_code ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy((project as any).client_code, 'client')}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    title="Copy Code"
                  >
                    {copiedId === 'client' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => handleShareLink('client', (project as any).client_code)}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors text-accent"
                    title="Share Access Link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground italic">Restricted</span>
              )}
            </div>
            <button
              onClick={() => setMemberModalType('client')}
              className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
            >
              {(project as any).totalClients || 0} {t('active_label')} {t('client')}s
              <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onTabChange?.('reports')}
              className="rounded-lg border border-border bg-secondary/20 p-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('reports_label')}</div>
              <div className="mt-1 text-lg font-bold text-foreground">{reports.length}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{t('view_reports')}</div>
            </button>
            <button
              onClick={() => onTabChange?.('snags')}
              className="rounded-lg border border-border bg-secondary/20 p-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('snags_label')}</div>
              <div className="mt-1 text-lg font-bold text-foreground">{t('view')}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{t('open_issues')}</div>
            </button>
          </div>
        </>
      )}

      {/* Project Members & Codes */}
      {userRole === 'contributor' && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('access_codes')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('contributor_code_label')}</span>
              <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-sm font-bold text-foreground">{(project as any).contributor_code || '—'}</span>
                {(project as any).contributor_code ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy((project as any).contributor_code, 'contributor')}
                      className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                      title="Copy Code"
                    >
                      {copiedId === 'contributor' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => handleShareLink('contributor', (project as any).contributor_code)}
                      className="p-1.5 hover:bg-secondary rounded-md transition-colors text-accent"
                      title="Share Access Link"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">Restricted</span>
                )}
              </div>
              <span 
                 className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
                 onClick={() => setMemberModalType('contributor')}
              >
                  {(project as any).totalContributors || 0} {t('active_label')} {t('contributor')}s
                  <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            
            <div className="flex flex-col gap-1 justify-center">
               <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('client_list_label')}</span>
               <div className="flex items-center justify-between bg-card/50 border border-border/50 border-dashed rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground italic">{t('code_restricted')}</span>
                <div className="p-1.5 opacity-30">
                  <Share2 className="h-4 w-4" />
                </div>
              </div>
              <span 
                 className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
                 onClick={() => setMemberModalType('client')}
              >
                  {(project as any).totalClients || 0} {t('active_label')} {t('client')}s
                  <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Display Codes */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('access_codes')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('contributor_code_label')}</span>
              <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-sm font-bold">{project.contributor_code}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(project.contributor_code, 'contributor')}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    title="Copy Code"
                  >
                    {copiedId === 'contributor' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => handleShareLink('contributor', project.contributor_code)}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors text-accent"
                    title="Share Access Link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span 
                   className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
                   onClick={() => setMemberModalType('contributor')}
                >
                    {(project as any).totalContributors || 0} {t('active_label')} {t('contributor')}s
                    <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{t('client_code_label')}</span>
              <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-sm font-bold">{project.client_code}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(project.client_code, 'client')}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    title="Copy Code"
                  >
                    {copiedId === 'client' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => handleShareLink('client', project.client_code)}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors text-accent"
                    title="Share Access Link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <span 
                 className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
                 onClick={() => setMemberModalType('client')}
              >
                  {(project as any).totalClients || 0} {t('active_label')} {t('client')}s
                  <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            variant="outline"
            className="w-full h-10 border-dashed border-accent/40 text-accent hover:bg-accent/5 hover:text-accent font-semibold text-xs flex items-center justify-center gap-1.5 mt-2"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite Vendor
          </Button>
          <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
            <div className="flex flex-col items-start text-left">
              <span className="text-xs font-bold text-foreground">Restrict Onboarding</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Only admins can invite contributors/clients to this project</span>
            </div>
            <button
              role="switch"
              aria-checked={!!project.restrict_onboarding}
              id="project_restrict_onboarding"
              onClick={async () => {
                const nextChecked = !project.restrict_onboarding;
                try {
                  await updateProject(project.id, { restrict_onboarding: nextChecked });
                  if (onProjectUpdate) {
                    onProjectUpdate({
                      ...project,
                      restrict_onboarding: nextChecked
                    });
                  }
                  toast.success(nextChecked ? "Onboarding restricted to Admins for this project" : "Onboarding restriction removed for this project");
                } catch (e) {
                  toast.error("Failed to update onboarding restriction");
                }
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                project.restrict_onboarding ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-800"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
                  project.restrict_onboarding ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>
      )}

      {/* Removed Recent Reports list as per user request */}
      {/* Keeping only Handover below */}



      {/* Handover */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{t('final_handover_report')}</h3>
          </div>
          
          {isExporting ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3 bg-secondary/30 rounded-lg border border-border/50">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-semibold animate-pulse">{exportStatusText || t('exporting_label')}</p>
                {isCountingDown && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 rounded-md border border-border">
                    <Clock className="h-3 w-3" />
                    {t('time_left').replace('{time}', formatElapsed(exportTimerMs))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {latestExport && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t('report_ready')}</span>
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                        {t('generated_label')} {new Date(latestExport.date).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.open(latestExport.url, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> {t('download_label')}
                  </Button>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full h-11 rounded-xl border-dashed text-sm"
                onClick={handleStartExport}
              >
                <PlayCircle className="h-4 w-4 mr-2" /> 
                {latestExport ? t('generate_new_report') : t('export_final_handover')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* EditProjectModal moved to Project.tsx */}

      {shareItem && (
        <ShareDialog
          open={!!shareItem}
          onOpenChange={() => setShareItem(null)}
          itemName={shareItem?.file_name || ''}
          downloadUrl={shareItem.downloadUrl}
          projectName={project.name}
          role={shareItem.role}
        />
      )}

      <Dialog open={!!memberModalType} onOpenChange={(open) => !open && setMemberModalType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize flex items-center gap-2 text-xl tracking-wide">
              <span className="text-accent uppercase tracking-widest text-sm bg-accent/10 px-3 py-1 rounded-full">{memberModalType}s</span> 
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4 max-h-[60vh] overflow-y-auto pr-2">
             {loadingMembers ? (
                <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
             ) : members.length === 0 ? (
                <div className="text-center p-6 text-sm text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border/50">{t('no_active_members').replace('{role}', memberModalType || '')}</div>
             ) : (
                members.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                     {m.secure_pic ? (
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full shadow-sm border border-border/50 bg-background">
                           <img src={m.secure_pic} alt={m.user.name} className="h-full w-full object-cover" />
                        </div>
                     ) : (
                        <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-secondary text-foreground font-semibold shadow-sm border border-border/50">
                           {m.user.name?.charAt(0).toUpperCase()}
                        </div>
                     )}
                     <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-bold truncate text-foreground">{m.user.name} {m.user.is_primary && t('primary_label')}</span>
                           {m.role === 'consultant' && (
                             <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
                               Consultant
                             </span>
                           )}
                           {m.role === 'vendor' && (
                             <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                               Vendor
                             </span>
                           )}
                           {m.role === 'contributor' && (
                             <span className="text-[9px] font-bold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                               Contributor
                             </span>
                           )}
                        </div>
                        <div className="flex flex-col gap-1 mt-1.5">
                           {m.user.email && (
                             <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium"><Mail className="h-3 w-3 text-accent" />{m.user.email}</span>
                           )}
                           {m.user.phone_number && (
                             <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium"><Phone className="h-3 w-3 text-accent" />{m.user.phone_number}</span>
                          )}
                        </div>
                     </div>
                     {canManageMembers && memberModalType && (
                        <button
                          onClick={() => setDeleteMemberObj(m)}
                          disabled={removingMemberId === m.user.id}
                          className="shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          title="Remove from project"
                        >
                          {removingMemberId === m.user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                     )}
                  </div>
                ))
             )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteMemberObj} onOpenChange={(open) => !open && setDeleteMemberObj(null)}>
        <DialogContent>
          {deleteStep === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('remove_access_title')}</DialogTitle>
                <DialogDescription>
                  {t('remove_access_confirm').replace('{name}', deleteMemberObj?.user?.name || deleteMemberObj?.user?.email || deleteMemberObj?.user?.phone_number || '')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 flex flex-col sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setDeleteMemberObj(null)} disabled={removingMemberId !== null}>{t('cancel')}</Button>
                <Button
                  variant="outline"
                  onClick={() => handleRemoveMember(deleteMemberObj, false)}
                  disabled={removingMemberId !== null}
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {removingMemberId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : t('just_delete')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteStep('blockScope')}
                  disabled={removingMemberId !== null}
                  className="rounded-xl px-6 bg-red-600 hover:bg-red-700"
                >
                  {removingMemberId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : t('block_and_delete')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Block Scope Selection</DialogTitle>
                <DialogDescription>
                  Do you want to block this user from this project only, or from the whole organization?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 flex flex-col sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setDeleteStep('confirm')} disabled={removingMemberId !== null}>Back</Button>
                <Button
                  variant="outline"
                  onClick={() => handleRemoveMember(deleteMemberObj, true, 'project')}
                  disabled={removingMemberId !== null}
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {removingMemberId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : 'This Project Only'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveMember(deleteMemberObj, true, 'org')}
                  disabled={removingMemberId !== null}
                  className="rounded-xl px-6 bg-red-600 hover:bg-red-700"
                >
                  {removingMemberId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Whole Org'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteModalOpen} onOpenChange={(open) => !open && setIsInviteModalOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl tracking-wide">
              <span className="text-accent uppercase tracking-widest text-sm bg-accent/10 px-3 py-1 rounded-full">Invite Vendor</span>
            </DialogTitle>
          </DialogHeader>
          
          {generatedInviteUrl ? (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-foreground">Invitation Link Generated!</h4>
                <p className="text-xs text-muted-foreground">Share this secure link with the consultant/vendor so they can access the project.</p>
              </div>
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5 font-mono text-xs break-all">
                <span className="flex-1 select-all">{generatedInviteUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedInviteUrl, 'invite-link')}
                  className="p-2 bg-card border border-border hover:bg-secondary rounded-md transition-colors shrink-0"
                  title="Copy Link"
                >
                  {copiedId === 'invite-link' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareItem({
                      file_name: "Project Invite (Vendor)",
                      downloadUrl: generatedInviteUrl,
                      role: inviteRole
                    });
                  }}
                  className="p-2 bg-card border border-border hover:bg-secondary rounded-md transition-colors shrink-0 text-accent"
                  title="Share Invite"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setIsInviteModalOpen(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email or Phone Number</label>
                <input
                  type="text"
                  placeholder="Email or 10-digit Phone Number"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>



              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Folder Permissions</label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    className="h-10 w-full justify-start text-xs font-semibold" 
                    onClick={() => setShowFolderPicker(true)}
                  >
                    <Folder className="h-4 w-4 mr-2 text-accent" />
                    {selectedFolders.length > 0 ? `Manage Folder Permissions (${selectedFolders.length})` : 'Select Folders'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="bg-accent hover:bg-accent/90 text-white font-bold px-5"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <FolderPickerDialog 
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        project={project}
        selectedFolderIds={selectedFolders}
        onlyTopLevel={true}
        hideCreate={true}
        title="Folder Permissions"
        onSelect={(ids) => {
          setSelectedFolders(ids);
          setShowFolderPicker(false);
        }}
      />
    </div>
  );
};

export default ProjectOverview;
