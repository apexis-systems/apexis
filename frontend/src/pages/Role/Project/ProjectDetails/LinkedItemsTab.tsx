"use client";

import { useState, useEffect } from 'react';
import { RFI, getFolderRFIs } from '@/services/rfiService';
import { Snag, getFolderSnags } from '@/services/snagService';
import { HelpCircle, AlertTriangle, Loader2, Calendar, User, ArrowRight, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

interface LinkedItemsTabProps {
    folderId?: string | number | null;
    projectId?: string | number | null;
}

const LinkedItemsTab = ({ folderId = null, projectId = null }: LinkedItemsTabProps) => {
    const { t } = useLanguage();
    const [rfis, setRfis] = useState<RFI[]>([]);
    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'rfis' | 'snags'>('rfis');
    const router = useRouter();

    useEffect(() => {
        if (folderId) {
            setLoading(true);
            Promise.all([
                getFolderRFIs(folderId).catch(err => { console.error(err); return []; }),
                getFolderSnags(folderId).catch(err => { console.error(err); return []; })
            ])
            .then(([rfiData, snagData]) => {
                setRfis(rfiData);
                setSnags(snagData);
                if (rfiData.length === 0 && snagData.length > 0) {
                    setActiveSubTab('snags');
                } else {
                    setActiveSubTab('rfis');
                }
            })
            .finally(() => setLoading(false));
        }
    }, [folderId]);

    const handleRFIClick = (rfiId: number) => {
        const returnContext = folderId ? `&returnTab=documents&returnFolderId=${folderId}` : '';
        router.push(`?tab=rfi&rfiId=${rfiId}${returnContext}`);
    };

    const handleSnagClick = (snagId: number) => {
        const returnContext = folderId ? `&returnTab=documents&returnFolderId=${folderId}` : '';
        router.push(`?tab=snags&snagId=${snagId}${returnContext}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Loading linked items...</p>
            </div>
        );
    }

    const hasNoItems = rfis.length === 0 && snags.length === 0;

    if (hasNoItems) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs font-semibold text-foreground">No Linked Items</p>
                <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1">
                    There are no RFIs or Snags linked to this folder yet.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-2">
            {/* Sub-tab selection */}
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 max-w-[240px] mx-auto">
                <button
                    onClick={() => setActiveSubTab('rfis')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
                        activeSubTab === 'rfis'
                            ? 'bg-background text-primary shadow-sm border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    RFIs ({rfis.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('snags')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
                        activeSubTab === 'snags'
                            ? 'bg-background text-primary shadow-sm border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Snags ({snags.length})
                </button>
            </div>

            {/* Linked RFIs Section */}
            {activeSubTab === 'rfis' && (
                rfis.length > 0 ? (
                    <div className="space-y-2">
                        {rfis.map((rfi) => (
                            <div 
                                key={rfi.id}
                                onClick={() => handleRFIClick(rfi.id)}
                                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-accent hover:shadow-sm transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                                        <HelpCircle className="h-4 w-4 text-accent" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[11px] font-bold text-foreground truncate group-hover:text-accent transition-colors">
                                            {rfi.title}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                <Calendar className="h-2.5 w-2.5" />
                                                {new Date(rfi.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                <User className="h-2.5 w-2.5" />
                                                {rfi.creator?.name}
                                            </div>
                                            <div className={
                                                `px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold uppercase tracking-tighter ${
                                                    rfi.status === 'open' ? 'bg-amber-100 text-amber-700' : 
                                                    rfi.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`
                                            }>
                                                {rfi.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <HelpCircle className="h-6 w-6 text-muted-foreground/30 mb-2" />
                        <p className="text-[10px] text-muted-foreground">No Linked RFIs</p>
                    </div>
                )
            )}

            {/* Linked Snags Section */}
            {activeSubTab === 'snags' && (
                snags.length > 0 ? (
                    <div className="space-y-2">
                        {snags.map((snag) => (
                            <div 
                                key={snag.id}
                                onClick={() => handleSnagClick(snag.id)}
                                className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-accent hover:shadow-sm transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                        <AlertTriangle className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[11px] font-bold text-foreground truncate group-hover:text-accent transition-colors">
                                            {snag.title}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                <Calendar className="h-2.5 w-2.5" />
                                                {new Date(snag.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                <User className="h-2.5 w-2.5" />
                                                {snag.creator?.name || '—'}
                                            </div>
                                            <div className={
                                                `px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold uppercase tracking-tighter ${
                                                    snag.status === 'amber' ? 'bg-amber-100 text-amber-700' : 
                                                    snag.status === 'green' ? 'bg-emerald-100 text-emerald-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`
                                            }>
                                                {snag.status === 'amber' ? t('waiting_clearance') || 'Amber' :
                                                 snag.status === 'green' ? t('completed_status') || 'Green' :
                                                 t('no_action_required') || 'Red'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertTriangle className="h-6 w-6 text-muted-foreground/30 mb-2" />
                        <p className="text-[10px] text-muted-foreground">No Linked Snags</p>
                    </div>
                )
            )}
        </div>
    );
};

export default LinkedItemsTab;
