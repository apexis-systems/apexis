"use client";

import { useState, useEffect } from 'react';
import { Project, UserRole } from '@/types';
import { FileText, Calendar, Loader2, Image, ClipboardList, ChevronDown, ChevronUp, FileCheck, Download, BarChart3, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReports, Report, triggerReport, downloadReport, regenerateReport } from '@/services/reportService';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiErrorMessage } from '@/helpers/apiError';
import { toast } from 'sonner';

interface Props { project: Project; userRole: UserRole; }

type ReportType = 'daily' | 'weekly' | 'monthly';

const ProjectReports = ({ project, userRole }: Props) => {
  const { t } = useLanguage();
  if (!project) return null;
  const [activeType, setActiveType] = useState<ReportType>('daily');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [options, setOptions] = useState({
    snag: true,
    rfi: true,
    photos: true,
    files: true
  });

  const handleRegenerate = async (reportId: number) => {
    setRegeneratingId(reportId);
    try {
      await regenerateReport(reportId);
      toast.success(t('report_regenerated_success') || 'Report regenerated successfully');
      fetchReports();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('failed_regenerate_report') || 'Failed to regenerate report'));
    } finally {
      setRegeneratingId(null);
    }
  };


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
      toast.error(getApiErrorMessage(e, t('failed_load_reports').replace('{type}', t(activeType + '_label'))));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (r: Report) => {
    setSelectedReport(r);
    setShowOptionsModal(true);
  };

  const confirmDownload = async () => {
    if (!selectedReport) return;
    const r = selectedReport;
    setShowOptionsModal(false);

    setDownloadingId(r.id);
    try {

      const sanitize = (name?: string | number) => {
        const raw = String(name ?? project?.name ?? project?.id ?? 'project');
        return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
      };
      const base = `${sanitize(project?.name ?? project?.id)}`;
      const start = new Date(r.period_start);
      const end = new Date(r.period_end);

      const fmtDate = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      };

      let filename = `${base}_daily_report_${fmtDate(start)}.pdf`;
      if (activeType === 'weekly') {
        filename = `${base}_weekly_report_${fmtDate(start)}_to_${fmtDate(end)}.pdf`;
      } else if (activeType === 'monthly') {
        const monthName = start.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase();
        const year = start.getFullYear();
        filename = `${base}_monthly_report_${monthName}-${year}.pdf`;
      }

      await downloadReport(r.id, filename, {
        snag: options.snag,
        rfi: options.rfi,
        photos: options.photos,
        Files: options.files
      });

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
      text = t('waiting_clearance');
    } else if (s === 'open' || s === 'pending') {
      colorClass = "bg-amber-100 text-amber-700";
      text = t('open_status');
    } else if (s === 'green' || s === 'completed') {
      colorClass = "bg-emerald-100 text-emerald-700";
      text = t('completed_status');
    } else if (s === 'resolved' || s === 'closed') {
      colorClass = "bg-emerald-100 text-emerald-700";
      text = t('resolved_status');
    } else if (s === 'red') {
      colorClass = "bg-red-100 text-red-700";
      text = t('no_action_required');
    } else if (s === 'overdue' || s === 'critical') {
      colorClass = "bg-red-100 text-red-700";
      text = t('overdue_status');
    }
    return <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold uppercase tracking-wider ${colorClass}`}>{text}</span>;
  };

  const tabs: { key: ReportType; label: string; icon: any }[] = [
    { key: 'daily', label: t('daily_label'), icon: ClipboardList },
    { key: 'weekly', label: t('weekly_label'), icon: BarChart3 },
    { key: 'monthly', label: t('monthly_label'), icon: Calendar },
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
          {generating ? t('generating_label') : t('generate_report_btn').replace('{type}', t(activeType + '_label'))}
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
                      {t(activeType + '_report')} — {fmt(r.period_start)}
                      {activeType === 'weekly' && ` ${t('report_period_to')} ${fmt(r.period_end)}`}
                    </p>
                    <div className="flex items-center gap-2">
                      {userRole !== 'client' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRegenerate(r.id); }}
                          disabled={regeneratingId === r.id || downloadingId === r.id}
                          className="p-2 rounded-lg hover:bg-accent/10 text-accent transition-colors disabled:opacity-50"
                          title={t('regenerate_report_tip') || 'Regenerate Report'}
                        >
                          {regeneratingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                      {(r.photos_count > 0 || r.docs_count > 0 || (r.summary?.rfis?.length || 0) > 0 || (r.summary?.snags?.length || 0) > 0) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                          disabled={downloadingId === r.id || regeneratingId === r.id}
                          className="p-2 rounded-lg hover:bg-accent/10 text-accent transition-colors disabled:opacity-50"
                          title={t('download_pdf_tip')}
                        >
                          {downloadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </button>
                      )}
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded-full"><Image className="h-3 w-3" />{t('photos_count_label').replace('{count}', String(r.photos_count))}</span>
                    <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-0.5 rounded-full"><FileText className="h-3 w-3" />{t('files_count_label').replace('{count}', String(r.docs_count))}</span>
                  </div>
                </div>
              </div>

              {expandedId === r.id && r.summary && (
                <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/5">
                  <div className="mt-3 space-y-3">
                    {!r.summary.document_titles?.length && !r.summary.photo_summary?.length && !r.summary.photo_details?.length && !r.summary.rfis?.length && !r.summary.snags?.length && (
                      <p className="text-[10px] text-muted-foreground py-3 text-center italic">{t('no_detail_records')}</p>
                    )}
                    {r.summary.document_titles && r.summary.document_titles.length > 0 && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> {t('docs_uploaded_title')}
                        </p>
                        <ul className="text-[9px] text-muted-foreground list-disc list-inside grid grid-cols-2 gap-x-4">
                          {r.summary.document_titles.map((doc: any, idx) => (
                            <li key={idx} className="truncate py-0.5">
                              <span className="font-medium text-foreground">{typeof doc === 'object' ? doc.title : doc}</span>
                              {typeof doc === 'object' && doc.user && ` ${t('uploaded_by_in').replace('{user}', doc.user).replace('{folder}', doc.folder)}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.summary.photo_summary && r.summary.photo_summary.length > 0 && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">
                          <Image className="h-3 w-3" /> {t('photos_uploaded_title')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {r.summary.photo_summary.map((ps, idx) => (
                            <p key={idx} className="text-[9px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-accent/50" />
                              {t('photos_by_in').replace('{count}', String(ps.count)).replace('{user}', ps.user).replace('{folder}', ps.folder)}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {(r.summary.rfis && r.summary.rfis.length > 0) || (r.summary.snags && r.summary.snags.length > 0) ? (
                      <div className="flex gap-3">
                        {r.summary.rfis && r.summary.rfis.length > 0 && (
                          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border/50">
                            <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">{t('rfi_label')}</p>
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
                            <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1.5">{t('snags_label')}</p>
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
              <p className="mt-3 text-sm font-medium text-muted-foreground">{t('no_reports_found').replace('{type}', t(activeType + '_label'))}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('generate_to_start')}</p>
            </div>
          )}
        </div>
      )}
      {/* Selection Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-[320px] rounded-3xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-sm font-bold mb-1">{t('export_options_title')}</h3>
              <p className="text-[10px] text-muted-foreground mb-6">{t('export_options_subtitle')}</p>

              <div className="space-y-1 mb-6">
                {[
                  { key: 'snag', label: t('snags_label'), icon: ClipboardList },
                  { key: 'rfi', label: t('rfi_label'), icon: FileCheck },
                  { key: 'photos', label: t('photos'), icon: Image },
                  { key: 'files', label: t('files_label'), icon: FileText },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = options[opt.key as keyof typeof options];
                  return (
                    <label key={opt.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-lg transition-colors", isChecked ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold">{opt.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof typeof prev] }))}
                        className="sr-only"
                      />
                      <div className={cn(
                        "w-8 h-4.5 rounded-full relative transition-colors duration-200",
                        isChecked ? "bg-accent" : "bg-muted-foreground/30"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
                          isChecked ? "translate-x-3.5" : "translate-x-0"
                        )} />
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowOptionsModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-[11px] font-bold hover:bg-muted transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDownload}
                  className="flex-1 h-10 rounded-xl bg-accent text-white text-[11px] font-bold hover:bg-accent/90 transition-colors shadow-sm"
                >
                  {t('download_label')}
                </button>
              </div>
            </div>
          </div>
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
