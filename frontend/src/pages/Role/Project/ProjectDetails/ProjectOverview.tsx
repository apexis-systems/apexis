"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { CalendarDays, FileText, Camera, Download, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReports, Report } from '@/services/reportService';
import { getFiles } from '@/services/fileService';

interface ProjectOverviewProps {
  project: Project;
  userRole: UserRole;
}

const ProjectOverview = ({ project, userRole }: ProjectOverviewProps) => {
  if (!project) return <div className="p-4 text-center text-sm text-muted-foreground">Loading project overview...</div>;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [photosCount, setPhotosCount] = useState<number>(0);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [counting, setCounting] = useState(true);

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
        if (data.folderData) {
          data.folderData.forEach((f: any) => {
            if (f.files) {
              f.files.forEach((file: any) => {
                if (file.file_type?.startsWith('image/')) photos++;
                else docs++;
              });
            }
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

  return (
    <div className="mt-4 space-y-4">
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
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Documents</span>
          </div>
          <div className="mt-1 text-xl font-bold">{counting ? '...' : docsCount}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4" />
            <span className="text-xs">Photos</span>
          </div>
          <div className="mt-1 text-xl font-bold">{counting ? '...' : photosCount}</div>
        </div>
      </div>

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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="h-4 w-4 text-muted-foreground" />
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
        <Button variant="outline" className="w-full h-11 rounded-xl border-dashed text-sm">
          <Download className="h-4 w-4 mr-2" /> Export Final Handover Package
        </Button>
      )}
    </div>
  );
};

export default ProjectOverview;
