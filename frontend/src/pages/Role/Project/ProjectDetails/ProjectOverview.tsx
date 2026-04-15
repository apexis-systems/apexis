"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { CalendarDays, FileText, Camera, Download, Clock, Loader2, Copy, Check, Pencil, PlayCircle, Share2, CheckCircle2, BarChart3, ChevronRight, Mail, Phone, Trash2 } from 'lucide-react';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportHandoverPackage, getLatestExport, getProjectShareLinks, getProjectMembers, removeProjectMember } from '@/services/projectService';
import { useSocket } from '@/contexts/SocketContext';
import { getReports, Report } from '@/services/reportService';
import { getFiles, getSecureFileUrl } from '@/services/fileService';
import ShareDialog from '@/components/shared/ShareDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/helpers/apiError';


interface ProjectOverviewProps {
  project: Project;
  userRole: UserRole;
  onProjectUpdate?: (updated: Project) => void;
  onTabChange?: (tab: 'documents' | 'photos' | 'reports' | 'snags') => void;
  onEditClick?: (field?: 'start_date' | 'end_date') => void;
}

const ProjectOverview = ({ project, userRole, onProjectUpdate, onTabChange, onEditClick }: ProjectOverviewProps) => {
  if (!project) return <div className="p-4 text-center text-sm text-muted-foreground">Loading project overview...</div>;
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

  useEffect(() => {
    if (!memberModalType || !project?.id) return;
    setLoadingMembers(true);
    getProjectMembers(project.id)
      .then(async data => {
         const fetchedMembers = data.members.filter((m: any) => m.role === memberModalType);
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

  const handleRemoveMember = async (member: any) => {
    if (!project?.id || !member?.user?.id) return;
    try {
      setRemovingMemberId(member.user.id);
      await removeProjectMember(project.id, member.user.id);
      toast.success('Project access removed');
      const refreshed = await getProjectMembers(project.id);
      const fetchedMembers = refreshed.members.filter((m: any) => m.role === memberModalType);
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
      toast.error(getApiErrorMessage(e, 'Failed to remove project access'));
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
    if (userRole !== 'admin' || !project?.id) return;
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
    if (!socket || userRole !== 'admin') return;

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
        toast.success(`Export completed in ${Math.round(data.totalTimeMs / 1000)}s!`);
      } else if (data.statusType === 'failed') {
        setIsExporting(false);
        toast.error('Export failed: ' + data.status);
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
      setExportStatusText('Starting export process...');
      setExportTimerMs(0);
      setIsCountingDown(false);
      await exportHandoverPackage(project.id);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Failed to trigger export'));
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
    toast.success('Copied to clipboard');
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
      toast.error("Failed to generate share link");
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
              onClick={() => onEditClick?.('start_date')}
            >
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-accent transition-colors">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs">Start Date</span>
              </div>
              <div className="mt-1 text-sm font-semibold">{project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}</div>
            </div>
            <div 
              className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
              onClick={() => onEditClick?.('end_date')}
            >
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-accent transition-colors">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs">End Date</span>
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
            <span className="text-xs">Documents</span>
          </div>
          <div className="mt-1 text-xl font-bold text-accent">{counting ? '...' : docsCount}</div>
        </div>
        <div 
          className="rounded-xl bg-card border border-border p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
          onClick={() => onTabChange?.('photos')}
        >
          <div className="flex items-center gap-2 text-accent group-hover:text-accent/80 transition-colors">
            <Camera className="h-4 w-4" />
            <span className="text-xs">Photos</span>
          </div>
          <div className="mt-1 text-xl font-bold text-accent">{counting ? '...' : photosCount}</div>
        </div>
      </div>

      {isClient && (
        <>
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client Project Code</div>
            <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
              <span className="font-mono text-sm font-bold text-foreground">{project.client_code || '—'}</span>
              {project.client_code && (
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
              )}
            </div>
            <button
              onClick={() => setMemberModalType('client')}
              className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
            >
              {(project as any).totalClients || 0} active {(project as any).totalClients === 1 ? 'client' : 'clients'}
              <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onTabChange?.('reports')}
              className="rounded-lg border border-border bg-secondary/20 p-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Reports</div>
              <div className="mt-1 text-lg font-bold text-foreground">{reports.length}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">View reports</div>
            </button>
            <button
              onClick={() => onTabChange?.('snags')}
              className="rounded-lg border border-border bg-secondary/20 p-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Snags</div>
              <div className="mt-1 text-lg font-bold text-foreground">View</div>
              <div className="mt-1 text-[10px] text-muted-foreground">Open issues</div>
            </button>
          </div>
        </>
      )}

      {/* Project Members */}
      {userRole === 'contributor' && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMemberModalType('contributor')}
              className="text-left rounded-lg border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Contributors</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-foreground">{(project as any).totalContributors || 0}</span>
                <ChevronRight className="h-4 w-4 text-accent" />
              </div>
            </button>
            <button
              onClick={() => setMemberModalType('client')}
              className="text-left rounded-lg border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors"
            >
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Clients</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-foreground">{(project as any).totalClients || 0}</span>
                <ChevronRight className="h-4 w-4 text-accent" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Admin Display Codes */}
      {userRole === 'admin' && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Codes</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Contributor Code</span>
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
              <span 
                 className="text-[10px] font-semibold text-muted-foreground ml-1 mt-0.5 flex items-center hover:text-foreground cursor-pointer transition-colors w-fit group"
                 onClick={() => setMemberModalType('contributor')}
              >
                  {(project as any).totalContributors || 0} active {(project as any).totalContributors === 1 ? 'contributor' : 'contributors'}
                  <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">Client Code</span>
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
                  {(project as any).totalClients || 0} active {(project as any).totalClients === 1 ? 'client' : 'clients'}
                  <ChevronRight className="h-3 w-3 ml-0.5 text-accent group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Removed Recent Reports list as per user request */}
      {/* Keeping only Handover below */}



      {/* Handover */}
      {userRole === 'admin' && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Final Handover Report</h3>
          </div>
          
          {isExporting ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3 bg-secondary/30 rounded-lg border border-border/50">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-semibold animate-pulse">{exportStatusText || 'Exporting...'}</p>
                {isCountingDown && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 rounded-md border border-border">
                    <Clock className="h-3 w-3" />
                    {formatElapsed(exportTimerMs)} left
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
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Report Ready</span>
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                        Generated {new Date(latestExport.date).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.open(latestExport.url, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full h-11 rounded-xl border-dashed text-sm"
                onClick={handleStartExport}
              >
                <PlayCircle className="h-4 w-4 mr-2" /> 
                {latestExport ? 'Generate New Report' : 'Export Final Handover Report'}
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
                <div className="text-center p-6 text-sm text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border/50">No active {memberModalType}s found</div>
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
                        <span className="text-sm font-bold truncate text-foreground">{m.user.name} {m.user.is_primary && '(Primary)'}</span>
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
                          onClick={() => handleRemoveMember(m)}
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
    </div>
  );
};

export default ProjectOverview;
