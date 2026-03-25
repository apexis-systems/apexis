"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { FileText, Calendar, Loader2, Image, TrendingUp, ChevronDown, ChevronUp, FileCheck } from 'lucide-react';
import { getReports, Report, triggerReport } from '@/services/reportService';

interface Props { project: Project; userRole: UserRole; }

const ProjectWeeklyReports = ({ project, userRole }: Props) => {
  if (!project) return null;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchReports = () => {
    if (!project?.id) return;
    setLoading(true);
    getReports(project.id as any, 'weekly')
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, [project?.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await triggerReport(project.id, 'weekly');
      fetchReports();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  const StatusBadge = ({ status }: { status: string }) => {
    const s = status?.toLowerCase();
    let colorClass = "bg-muted text-muted-foreground";
    let text = s;
    if (['open', 'amber', 'pending'].includes(s)) {
      colorClass = "bg-amber-100 text-amber-700";
      text = 'OPEN';
    } else if (['closed', 'green', 'resolved'].includes(s)) {
      colorClass = "bg-emerald-100 text-emerald-700";
      text = 'RESOLVED';
    } else if (['overdue', 'red', 'critical'].includes(s)) {
      colorClass = "bg-red-100 text-red-700";
      text = s === 'overdue' ? 'OVERDUE' : 'OPEN';
    }
    return <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold uppercase tracking-wider ${colorClass}`}>{text}</span>;
  };

  return (
    <div className="mt-3">
      {userRole !== 'client' && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mb-3 h-9 rounded-lg bg-accent text-white text-[11px] font-semibold flex items-center justify-center gap-2 hover:bg-accent/90 disabled:opacity-50 transition-all"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
          {generating ? 'Generating...' : "Generate This Week's Report"}
        </button>
      )}
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className="rounded-lg bg-card border border-border overflow-hidden">
            <div 
              className="flex items-start gap-2.5 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
                <TrendingUp className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-semibold">
                    Weekly Report — {fmt(r.period_start)} to {fmt(r.period_end)}
                  </p>
                  {expandedId === r.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Image className="h-2.5 w-2.5" />{r.photos_count} photos</span>
                  <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{r.docs_count} docs</span>
                </div>
              </div>
            </div>

            {expandedId === r.id && r.summary && (
              <div className="px-3 pb-3 pt-0 border-t border-border mt-1">
                <div className="mt-2 space-y-2">
                  {!r.summary.document_titles?.length && !r.summary.photo_summary?.length && !r.summary.photo_details?.length && !r.summary.rfis?.length && !r.summary.snags?.length && (
                    <p className="text-[9px] text-muted-foreground py-2 text-center italic">No detail records for this period</p>
                  )}
                  {r.summary.document_titles && r.summary.document_titles.length > 0 && (
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-[9px] font-semibold text-accent mb-1 flex items-center gap-1">
                        <FileText className="h-2.5 w-2.5" /> Documents Uploaded
                      </p>
                      <ul className="text-[8.5px] text-muted-foreground list-disc list-inside">
                        {r.summary.document_titles.map((title, idx) => <li key={idx} className="truncate">{title}</li>)}
                      </ul>
                    </div>
                  )}

                  {r.summary.photo_summary && r.summary.photo_summary.length > 0 ? (
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-[9px] font-semibold text-accent mb-1 flex items-center gap-1">
                        <Image className="h-2.5 w-2.5" /> Photos Uploaded
                      </p>
                      <div className="space-y-1">
                        {r.summary.photo_summary.map((ps, idx) => (
                          <p key={idx} className="text-[8.5px] text-muted-foreground leading-tight">
                            <span className="font-medium">{ps.count} photos</span> by <span className="font-medium">{ps.user}</span> in <span className="font-medium">{ps.folder}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : r.summary.photo_details && r.summary.photo_details.length > 0 && (
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-[9px] font-semibold text-accent mb-1 flex items-center gap-1">
                        <Image className="h-2.5 w-2.5" /> Photos Uploaded (Legacy)
                      </p>
                      <div className="space-y-1">
                        {(() => {
                          const grouped: Record<string, any> = {};
                          r.summary.photo_details?.forEach((p: any) => {
                            const key = `${p.uploaded_by}_${p.folder}`;
                            if (!grouped[key]) grouped[key] = { count: 0, user: p.uploaded_by, folder: p.folder };
                            grouped[key].count++;
                          });
                          return Object.values(grouped).map((ps: any, idx) => (
                            <p key={idx} className="text-[8.5px] text-muted-foreground leading-tight">
                              <span className="font-medium">{ps.count} photos</span> by <span className="font-medium">{ps.user}</span> in <span className="font-medium">{ps.folder}</span>
                            </p>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {r.summary.released_files && r.summary.released_files.length > 0 && (
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-[9px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <FileCheck className="h-2.5 w-2.5" /> Released to Client (Legacy)
                      </p>
                      <ul className="text-[8.5px] text-muted-foreground list-disc list-inside">
                        {r.summary.released_files.map((name, idx) => <li key={idx} className="truncate">{name}</li>)}
                      </ul>
                    </div>
                  )}

                  {(r.summary.rfis && r.summary.rfis.length > 0) || (r.summary.snags && r.summary.snags.length > 0) ? (
                    <div className="flex gap-2">
                      {r.summary.rfis && r.summary.rfis.length > 0 && (
                        <div className="flex-1 bg-muted/30 rounded p-2">
                          <p className="text-[9px] font-semibold text-accent mb-1">RFIs</p>
                          <ul className="text-[8.5px] text-muted-foreground space-y-0.5">
                            {r.summary.rfis.map((rfi, idx) => (
                              <li key={idx} className="flex justify-between items-center bg-background/50 px-1 rounded">
                                <span className="truncate max-w-[60%]">{rfi.title}</span>
                                <StatusBadge status={rfi.status} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.summary.snags && r.summary.snags.length > 0 && (
                        <div className="flex-1 bg-muted/30 rounded p-2">
                          <p className="text-[9px] font-semibold text-accent mb-1">Snags</p>
                          <ul className="text-[8.5px] text-muted-foreground space-y-0.5">
                            {r.summary.snags.map((snag, idx) => (
                              <li key={idx} className="flex justify-between items-center bg-background/50 px-1 rounded">
                                <span className="truncate max-w-[60%]">{snag.title}</span>
                                <StatusBadge status={snag.status} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
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
