"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { CalendarDays, FileText, Camera, Download, Clock, Loader2, Copy, Check, Pencil, PlayCircle, Share2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportHandoverPackage, getLatestExport } from '@/services/projectService';
import { useSocket } from '@/contexts/SocketContext';
import { getReports, Report } from '@/services/reportService';
import { getFiles } from '@/services/fileService';
import EditProjectModal from "@/components/Project/EditProjectModal";

interface ProjectOverviewProps {
  project: Project;
  userRole: UserRole;
  onProjectUpdate?: (updated: Project) => void;
  onTabChange?: (tab: 'documents' | 'photos') => void;
}

const ProjectOverview = ({ project, userRole, onProjectUpdate, onTabChange }: ProjectOverviewProps) => {
  if (!project) return <div className="p-4 text-center text-sm text-muted-foreground">Loading project overview...</div>;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [photosCount, setPhotosCount] = useState<number>(0);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [counting, setCounting] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const handleStartExport = async () => {
    try {
      if (!project?.id) return;
      setIsExporting(true);
      setExportStatusText('Starting export process...');
      setExportTimerMs(0);
      setIsCountingDown(false);
      await exportHandoverPackage(project.id);
    } catch (e: any) {
      toast.error('Failed to trigger export');
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

  const dailyReports = reports.filter(r => r.type === 'daily');
  const weeklyReports = reports.filter(r => r.type === 'weekly');
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

  const handleShareLink = async (role: 'contributor' | 'client', code: string) => {
    const deepUrl = `${window.location.origin}/auth/login-redirect?role=${role}&code=${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Project as ${role === 'contributor' ? 'Contributor' : 'Client'}`,
          text: `Click the link to access the project on Apexis.`,
          url: deepUrl,
        });
      } catch (err) {
        // Fallback or user canceled
        console.log("Share failed or canceled", err);
      }
    } else {
      handleCopy(deepUrl, `${role}-link`);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Project Description */}
      {(project.description || userRole === 'admin') && (
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About the Project</h3>
            {userRole === 'admin' && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-accent"
                title="Edit Project"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {project.description ? (
            <p className="text-sm text-foreground leading-relaxed italic">
              "{project.description}"
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No description provided. Click the edit icon to add one.
            </p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs">Start Date</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs">End Date</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{project.end_date ? new Date(project.end_date).toLocaleDateString() : '—'}</div>
        </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Reports Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Reports</h2>
        </div>

        {loading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-accent" /></div>}

        {/* Daily Reports */}
        {!loading && dailyReports.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Daily Site Reports</p>
            <div className="space-y-2">
              {dailyReports.map((report) => (
                <div key={report.id} className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                    <FileText className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">Daily Report — {fmt(report.period_start)}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{fmt(report.period_start)}</span>
                      <span>· {report.photos_count} photos · {report.docs_count} docs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Reports */}
        {!loading && weeklyReports.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Weekly Progress Reports</p>
            <div className="space-y-2">
              {weeklyReports.map((report) => (
                <div key={report.id} className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                    <FileText className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">Weekly Report — {fmt(report.period_start)} to {fmt(report.period_end)}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{fmt(report.period_start)} — {fmt(report.period_end)}</span>
                      <span>· {report.photos_count} photos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

      {userRole === 'admin' && (
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          project={project}
          onUpdate={(updated) => {
            if (onProjectUpdate) onProjectUpdate(updated);
          }}
        />
      )}
    </div>
  );
};

export default ProjectOverview;
