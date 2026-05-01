"use client";

import { useState, useEffect } from 'react';
import { RFI, getFolderRFIs } from '@/services/rfiService';
import { FileText, Loader2, Calendar, User, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LinkedRFITabProps {
    folderId: string | number;
    projectId: string | number;
}

const LinkedRFITab = ({ folderId, projectId }: LinkedRFITabProps) => {
    const [rfis, setRfis] = useState<RFI[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (folderId) {
            setLoading(true);
            getFolderRFIs(folderId)
                .then(setRfis)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [folderId]);

    const handleRFIClick = (rfiId: number) => {
        // Navigate to RFI tab and open the RFI
        router.push(`?tab=rfis&rfiId=${rfiId}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Loading linked RFIs...</p>
            </div>
        );
    }

    if (rfis.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs font-semibold text-foreground">No Linked RFIs</p>
                <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1">
                    There are no RFIs currently linked to this folder.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2 mt-2">
            {rfis.map((rfi) => (
                <div 
                    key={rfi.id}
                    onClick={() => handleRFIClick(rfi.id)}
                    className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-accent hover:shadow-sm transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                            <FileText className="h-4 w-4 text-accent" />
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
    );
};

export default LinkedRFITab;
