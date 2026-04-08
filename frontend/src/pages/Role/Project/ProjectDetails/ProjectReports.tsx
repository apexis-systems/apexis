"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { FileText, Calendar, Loader2, Image, ClipboardList, ChevronDown, ChevronUp, FileCheck, Download, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReports, Report, triggerReport, downloadReport } from '@/services/reportService';
import { getApiErrorMessage } from '@/helpers/apiError';
import { toast } from 'sonner';

interface Props { project: Project; userRole: UserRole; }

type ReportType = 'daily' | 'weekly' | 'monthly';

const ProjectReports = ({ project, userRole }: Props) => {
  if (!project) return null;
  const [activeType, setActiveType] = useState<ReportType>('daily');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchReports = () => {
    if (!project?.id) return;
    setLoading(true);
    getReports(project.id as any, activeType)
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
    setExpandedId(null);
  }, [project?.id, activeType]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await triggerReport(project.id, activeType);
      fetchReports();
    } catch (e) {
      toast.error(getApiErrorMessage(e, `Failed to generate ${activeType} report`));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (r: Report) => {
    setDownloadingId(r.id);
    try {
      const typeLabel = activeType.charAt(0).toUpperCase() + activeType.slice(1);
      await downloadReport(r.id, `${typeLabel}_Report_${fmt(r.period_start).replace(/ /g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  };

  const fmt = (d: string) => {
    const date = new Date(d);
    if (activeType === 'monthly') {
        return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = status?.toLowerCase();
    let colorClass = "bg-muted text-muted-foreground";
    let text = s;
    if (s === 'amber') {
      colorClass = "bg-amber-100 text-amber-700";
      text = 'Waiting for Clearance';
    } else if (s === 'open' || s === 'pending') {
      colorClass = "bg-amber-100 text-amber-700";
      text = 'OPEN';
    } else if (s === 'green' || s === 'completed') {
      colorClass = "bg-emerald-100 text-emerald-700";
      text = 'Completed';
    } else if (s === 'resolved' || s === 'closed') {
      colorClass = "bg-emerald-100 text-emerald-700";
      text = 'RESOLVED';
    } else if (s === 'red') {
      colorClass = "bg-red-100 text-red-700";
      text = 'No Action Required';
    } else if (s === 'overdue' || s === 'critical') {
      colorClass = "bg-red-100 text-red-700";
      text = 'OVERDUE';
    }
    return <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold uppercase tracking-wider ${colorClass}`}>{text}</span>;
  };

  const tabs: { key: ReportType; label: string; icon: any }[] = [
    { key: 'daily', label: 'Daily', icon: ClipboardList },
    { key: 'weekly', label: 'Weekly', icon: BarChart3 },
    { key: 'monthly', label: 'Monthly', icon: Calendar },
  ];

  return (
    <div className="mt-3">
      {/* Type Toggle */}
      <div className="flex p-1 bg-secondary rounded-xl mb-4 gap-1 w-fit mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeType === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-semibold transition-all",
                isActive 
                  ? "bg-card text-accent shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {userRole !== 'client' && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mb-4 h-10 rounded-xl bg-accent text-white text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-accent/90 disabled:opacity-50 transition-all shadow-sm"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconForKey type={activeType} />}
          {generating ? 'Generating...' : `Generate ${activeType.charAt(0).toUpperCase() + activeType.slice(1)} Report`}
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="rounded-xl bg-card border border-border overflow-hidden shadow-sm hover:border-accent/30 transition-all">
              <div 
                className="flex items-start gap-3.5 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shrink-0">
                  <IconForKey type={activeType} className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-[12px] font-bold">
                        {activeType === 'daily' ? 'Daily' : activeType === 'weekly' ? 'Weekly' : 'Monthly'} Report — {fmt(r.period_start)}
                        {activeType === 'weekly' && ` to ${fmt(r.period_end)}`}
                    </p>
                    <div className="flex items-center gap-2">
                      {(r.photos_count > 0 || r.docs_count > 0 || (r.summary?.rfis?.length || 0) > 0 || (r.summary?.snags?.length || 0) > 0) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                          disabled={downloadingId === r.id}
                          className="p-2 rounded-lg hover:bg-accent/10 text-accent transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </button>
                      )}
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded-full"><Image className="h-3 w-3" />{r.photos_count} photos</span>
                    <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded-full"><FileText className="h-3 w-3" />{r.docs_count} docs</span>
                  </div>
                </div>
              </div>

              {expandedId === r.id && r.summary && (
                <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/5">
                  <div className="mt-3 space-y-3">
                    {!r.summary.document_titles?.length && !r.summary.photo_summary?.length && !r.summary.photo_details?.length && !r.summary.rfis?.length && !r.summary.snags?.length && (
                      <p className="text-[10px] text-muted-foreground py-3 text-center italic">No detail records for this period</p>
                    )}
                    {r.summary.document_titles && r.summary.document_titles.length > 0 && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> Documents Uploaded
                        </p>
                        <ul className="text-[9px] text-muted-foreground list-disc list-inside grid grid-cols-2 gap-x-4">
                          {r.summary.document_titles.map((doc: any, idx) => (
                            <li key={idx} className="truncate py-0.5">
                              <span className="font-medium text-foreground">{typeof doc === 'object' ? doc.title : doc}</span>
                              {typeof doc === 'object' && doc.user && ` (by ${doc.user} in ${doc.folder})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.summary.photo_summary && r.summary.photo_summary.length > 0 && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">
                          <Image className="h-3 w-3" /> Photos Uploaded
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {r.summary.photo_summary.map((ps, idx) => (
                            <p key={idx} className="text-[9px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-accent/50" />
                              <span className="font-semibold text-foreground">{ps.count} photos</span> by {ps.user} in {ps.folder}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {(r.summary.rfis && r.summary.rfis.length > 0) || (r.summary.snags && r.summary.snags.length > 0) ? (
                      <div className="flex gap-3">
                        {r.summary.rfis && r.summary.rfis.length > 0 && (
                          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border/50">
                            <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">RFIs</p>
                            <ul className="text-[9px] text-muted-foreground space-y-1.5">
                              {r.summary.rfis.map((rfi, idx) => (
                                <li key={idx} className="flex justify-between items-center bg-card/50 px-2 py-1 rounded-lg border border-border/30">
                                  <span className="truncate max-w-[60%]">{rfi.title}</span>
                                  <StatusBadge status={rfi.status} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.summary.snags && r.summary.snags.length > 0 && (
                          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border/50">
                            <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">Snags</p>
                            <ul className="text-[9px] text-muted-foreground space-y-1.5">
                              {r.summary.snags.map((snag, idx) => (
                                <li key={idx} className="flex justify-between items-center bg-card/50 px-2 py-1 rounded-lg border border-border/30">
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
          {reports.length === 0 && (
            <div className="mt-12 text-center py-12 border-2 border-dashed border-border rounded-3xl">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/20" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No {activeType} reports found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Generate one to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const IconForKey = ({ type, className }: { type: ReportType; className?: string }) => {
    if (type === 'daily') return <ClipboardList className={className} />;
    if (type === 'weekly') return <BarChart3 className={className} />;
    return <Calendar className={className} />;
};

export default ProjectReports;
