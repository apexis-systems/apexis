"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { FileText, Calendar, Loader2, Image, TrendingUp } from 'lucide-react';
import { getReports, Report } from '@/services/reportService';

interface Props { project: Project; userRole: UserRole; }

const ProjectWeeklyReports = ({ project, userRole }: Props) => {
  if (!project) return null;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.id) return;
    getReports(project.id as any, 'weekly')
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [project?.id]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="mt-3">
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className="flex items-start gap-2.5 rounded-lg bg-card border border-border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
              <TrendingUp className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold">
                Weekly Report — {fmt(r.period_start)} to {fmt(r.period_end)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Image className="h-2.5 w-2.5" />{r.photos_count} photos</span>
                <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{r.docs_count} docs</span>
                {r.releases_count > 0 && <span>{r.releases_count} releases</span>}
                {r.comments_count > 0 && <span>{r.comments_count} comments</span>}
              </div>
              {r.summary && typeof r.summary === 'object' && (r.summary as any).by_user?.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">
                  By: {(r.summary as any).by_user.map((u: any) => `${u.name} (${u.uploads})`).join(', ')}
                </p>
              )}

            </div>
          </div>
        ))}
      </div>
      {reports.length === 0 && (
        <div className="mt-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No weekly reports yet</p>
        </div>
      )}
    </div>
  );
};

export default ProjectWeeklyReports;
