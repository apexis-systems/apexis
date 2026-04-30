"use client";

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    X, Plus, MessageSquare, ImagePlus, ZoomIn, Loader2,
    AlertCircle, CheckCircle, AlertTriangle, Clock, User, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/helpers/apiError';
import {
    RFI, RFIStatus, getRFIs, createRFI, updateRFIStatus, getRFIAssignees, updateRFIResponse,
    deleteRFI,
    updateRFI
} from '@/services/rfiService';
import { getAssignees, Assignee } from '@/services/snagService';
import ImageAnnotator from '@/components/common/ImageAnnotator';

interface ProjectRFIProps {
    project: Project;
    onUpdate?: () => void;
}

const STATUS_CONFIG: Record<RFIStatus, { icon: any; color: string; bg: string; label: string }> = {
    open: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Open' },
    closed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-600/10', label: 'Closed' },
    overdue: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Overdue' },
};

export default function ProjectRFI({ project, onUpdate }: ProjectRFIProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { checkLimit } = useUsage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialRfiId = searchParams?.get('rfiId');

    const [rfis, setRfis] = useState<RFI[]>([]);
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | RFIStatus>('all');
    const [creatorFilter, setCreatorFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

    // Modals
    const [showAdd, setShowAdd] = useState(false);
    const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newExpiryDate, setNewExpiryDate] = useState('');
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [responseBody, setResponseBody] = useState('');
    const [responsePhotos, setResponsePhotos] = useState<File[]>([]);
    const [responsePhotoPreviews, setResponsePhotoPreviews] = useState<string[]>([]);
    const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    const dataUrlToBlob = (dataUrl: string) => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
    };

    const handleAnnotateSave = (annotatedDataUrl: string) => {
        if (annotatingIdx === null) return;
        
        const blob = dataUrlToBlob(annotatedDataUrl);
        const fileName = newPhotos[annotatingIdx]?.name || `annotated_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        setNewPhotos((prev: File[]) => {
            const copy = [...prev];
            copy[annotatingIdx] = file;
            return copy;
        });
        
        setPhotoPreviews((prev: string[]) => {
            const copy = [...prev];
            copy[annotatingIdx] = annotatedDataUrl;
            return copy;
        });
        
        setAnnotatingIdx(null);
    };

    const load = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const [rfiData, assigneeData] = await Promise.all([
                getRFIs(project.id as any),
                getRFIAssignees(project.id as any),
            ]);
            setRfis(rfiData);
            setAssignees(assigneeData);
        } catch (e) {
            toast.error('Failed to load RFIs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [project?.id]);

    useEffect(() => {
        if (initialRfiId && rfis.length > 0) {
            const target = rfis.find(r => String(r.id) === String(initialRfiId));
            if (target) {
                setSelectedRFI(target);
                // Clear the ID from URL to prevent loop on back navigation
                const params = new URLSearchParams(window.location.search);
                params.delete('rfiId');
                const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
            }
        }
    }, [initialRfiId, rfis]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        if (validFiles.length !== files.length) toast.error('Some files were skipped (not images)');

        const total = newPhotos.length + validFiles.length;
        if (total > 3) {
            toast.error('Maximum 3 photos allowed');
            return;
        }

        setNewPhotos(prev => [...prev, ...validFiles]);

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => setPhotoPreviews(prev => [...prev, reader.result as string]);
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (idx: number, isResponse = false) => {
        if (isResponse) {
            setResponsePhotos(prev => prev.filter((_, i) => i !== idx));
            setResponsePhotoPreviews(prev => prev.filter((_, i) => i !== idx));
        } else {
            setNewPhotos((prev: File[]) => prev.filter((_, i) => i !== idx));
            setPhotoPreviews((prev: string[]) => prev.filter((_, i) => i !== idx));
        }
    };

    const addRFI = async () => {
        if (!newTitle.trim()) { toast.error('Title is required'); return; }
        if (!newAssignee) { toast.error('Assignee is required'); return; }

        if (!checkLimit('rfis')) {
            toast.error("Limit Reached: You have reached your RFI limit. Please upgrade your plan to create more RFIs.", {
                action: {
                    label: 'Upgrade',
                    onClick: () => router.push(`/${user?.role || 'admin'}/billing`)
                },
                duration: 5000,
            });
            return;
        }

        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('project_id', String(project.id));
            form.append('title', newTitle.trim());
            form.append('description', newDescription.trim());
            form.append('assigned_to', newAssignee);
            if (newExpiryDate) form.append('expiry_date', newExpiryDate);
            newPhotos.forEach(photo => form.append('photos', photo));

            await createRFI(form);
            toast.success('RFI created successfully');
            setShowAdd(false);
            resetForm();
            load();
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to create RFI'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateRFI = async () => {
        if (!selectedRFI) return;
        if (!newTitle.trim()) { toast.error('Title is required'); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('title', newTitle.trim());
            form.append('description', newDescription.trim());
            form.append('assigned_to', newAssignee);
            if (newExpiryDate) form.append('expiry_date', newExpiryDate);
            newPhotos.forEach(photo => form.append('photos', photo));

            const updated = await updateRFI(selectedRFI.id, form);
            toast.success('RFI updated successfully');
            setIsEditing(false);
            setSelectedRFI(updated);
            load();
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to update RFI'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRFI = async (id: number) => {
        if (!confirm('Are you sure you want to delete this RFI?')) return;
        try {
            await deleteRFI(id);
            toast.success('RFI deleted');
            setSelectedRFI(null);
            load();
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to delete RFI'));
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewDescription('');
        setNewAssignee('');
        setNewExpiryDate('');
        setNewPhotos([]);
        setPhotoPreviews([]);
    };

    const handleUpdateResponse = async () => {
        if (!selectedRFI) return;
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('response', responseBody);
            responsePhotos.forEach(p => form.append('photos', p));
            
            const updated = await updateRFIResponse(selectedRFI.id, form);
            toast.success('Response updated');
            setSelectedRFI(updated);
            setResponseBody('');
            setResponsePhotos([]);
            setResponsePhotoPreviews([]);
            load();
            if (onUpdate) onUpdate();
        } catch {
            toast.error('Failed to update response');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: RFIStatus) => {
        try {
            await updateRFIStatus(id, status);
            toast.success(`Status updated to ${status}`);
            load();
            if (onUpdate) onUpdate();
            if (selectedRFI?.id === id) {
                setSelectedRFI({ ...selectedRFI, status });
            }
        } catch {
            toast.error('Failed to update status');
        }
    };

    const filteredRfis = rfis.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesCreator = creatorFilter === 'all' || String(r.created_by) === creatorFilter;
        const matchesAssignee = assigneeFilter === 'all' || String(r.assigned_to) === assigneeFilter;
        return matchesStatus && matchesCreator && matchesAssignee;
    });

    if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold">Request for Information</h2>
                    <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> New RFI
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-secondary/20 rounded-xl border border-border">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Status</label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Created By</label>
                        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder="All Creators" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Creators</SelectItem>
                                {Array.from(new Set(rfis.map(r => r.creator?.id))).filter(Boolean).map(id => {
                                    const name = rfis.find(r => r.creator?.id === id)?.creator?.name;
                                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Assigned To</label>
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder="All Assignees" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Assignees</SelectItem>
                                <SelectItem value="null">Unassigned</SelectItem>
                                {Array.from(new Set(rfis.map(r => r.assignee?.id))).filter(Boolean).map(id => {
                                    const name = rfis.find(r => r.assignee?.id === id)?.assignee?.name;
                                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end pb-0.5">
                        {(statusFilter !== 'all' || creatorFilter !== 'all' || assigneeFilter !== 'all') && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[10px] h-8 text-muted-foreground hover:text-foreground"
                                onClick={() => { setStatusFilter('all'); setCreatorFilter('all'); setAssigneeFilter('all'); }}
                            >
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredRfis.map((rfi) => {
                    const cfg = STATUS_CONFIG[rfi.status];
                    const StatusIcon = cfg.icon;
                    return (
                        <div
                            key={rfi.id}
                            onClick={() => setSelectedRFI(rfi)}
                            className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-accent/50 transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={cn("mt-1 p-2 rounded-lg", cfg.bg)}>
                                        <StatusIcon className={cn("h-4 w-4", cfg.color)} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">{rfi.title}</h3>
                                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", cfg.bg, cfg.color)}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{rfi.description}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                        <Clock className="h-3 w-3" /> {new Date(rfi.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border">
                                        <span className="text-[10px] font-bold">{rfi.creator?.name?.charAt(0)}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">by {rfi.creator?.name}</span>
                                </div>
                                {rfi.assignee && (
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3 text-accent" />
                                        <span className="text-[10px] font-medium text-accent">Assigned to {rfi.assignee.name}</span>
                                    </div>
                                )}
                                {rfi.photos && rfi.photos.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Camera className="h-3 w-3" />
                                        <span className="text-[10px]">{rfi.photos.length} attachments</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredRfis.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground font-medium">No Request for Information found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Try changing your filters or create a new RFI</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={showAdd || isEditing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setIsEditing(false); resetForm(); } }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Request for Information' : 'New Request for Information'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Title *</label>
                            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Enter RFI title" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                            <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Provide more context..." className="min-h-[100px]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign To *</label>
                            <Select value={newAssignee} onValueChange={setNewAssignee}>
                                <SelectTrigger><SelectValue placeholder="Select assignee *" /></SelectTrigger>
                                <SelectContent>
                                    {assignees.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                            <Input type="datetime-local" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attachments</label>
                            <div className="flex flex-wrap gap-2">
                                {photoPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => setAnnotatingIdx(idx)} className="bg-accent p-1.5 rounded-full hover:scale-110 transition-transform">
                                                <Camera className="h-3 w-3 text-white" />
                                            </button>
                                            <button onClick={() => removePhoto(idx)} className="bg-destructive p-1.5 rounded-full hover:scale-110 transition-transform">
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <label className="w-20 h-20 border-dashed border-2 border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setShowAdd(false); setIsEditing(false); resetForm(); }} disabled={submitting}>Cancel</Button>
                        <Button onClick={isEditing ? handleUpdateRFI : addRFI} disabled={submitting || !newTitle.trim()} className="bg-accent text-accent-foreground">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isEditing ? <CheckCircle className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />)}
                            {isEditing ? 'Save Changes' : 'Create RFI'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!selectedRFI} onOpenChange={(open) => !open && setSelectedRFI(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto no-scrollbar">
                    {selectedRFI && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between gap-3 mb-2 pr-8">
                                    <div className="flex items-center gap-3">
                                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", STATUS_CONFIG[selectedRFI.status].bg, STATUS_CONFIG[selectedRFI.status].color)}>
                                            {STATUS_CONFIG[selectedRFI.status].label}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">RFI #{selectedRFI.id}</span>
                                    </div>
                                    {(String(selectedRFI.created_by) === String(user?.id) || String(selectedRFI.creator?.id) === String(user?.id)) && !selectedRFI.response && (
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 text-[10px]"
                                                onClick={() => {
                                                    setNewTitle(selectedRFI.title);
                                                    setNewDescription(selectedRFI.description || '');
                                                    setNewAssignee(String(selectedRFI.assigned_to));
                                                    setNewExpiryDate(selectedRFI.expiry_date ? new Date(selectedRFI.expiry_date).toISOString().slice(0, 16) : '');
                                                    setPhotoPreviews(selectedRFI.photoDownloadUrls || []);
                                                    setIsEditing(true);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <Button 
                                                variant="destructive" 
                                                size="sm" 
                                                className="h-7 text-[10px]"
                                                onClick={() => handleDeleteRFI(selectedRFI.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <DialogTitle className="text-xl leading-tight">{selectedRFI.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <div>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedRFI.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Created By</p>
                                        <p className="text-xs font-semibold">{selectedRFI.creator?.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedRFI.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Assigned To</p>
                                        <p className="text-xs font-semibold">{selectedRFI.assignee?.name || 'Unassigned'}</p>
                                    </div>
                                    {selectedRFI.expiry_date && (
                                        <div className="col-span-2 mt-2 pt-2 border-t border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Expiry Date</p>
                                            <p className={cn("text-xs font-semibold flex items-center gap-1.5", 
                                                selectedRFI.status === 'overdue' ? 'text-destructive' : 'text-foreground')}>
                                                <Clock className="h-3 w-3" />
                                                {new Date(selectedRFI.expiry_date).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {selectedRFI.photoDownloadUrls && selectedRFI.photoDownloadUrls.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Attachments</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {selectedRFI.photoDownloadUrls.map((url, idx) => (
                                                <div key={idx} onClick={() => setViewPhoto(url)} className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all group cursor-pointer">
                                                    <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ZoomIn className="h-5 w-5 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRFI.response && (
                                    <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                                        <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">Response</p>
                                        <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{selectedRFI.response}</p>
                                        {selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2">
                                                {selectedRFI.responsePhotoUrls.map((url, idx) => (
                                                    <div key={idx} onClick={() => setViewPhoto(url)} className="relative aspect-square rounded-lg overflow-hidden border border-border group cursor-pointer">
                                                        <img src={url} alt="Response photo" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <ZoomIn className="h-4 w-4 text-white" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {String(selectedRFI.assigned_to) === String(user?.id) && selectedRFI.status !== 'closed' && (
                                    <div className="space-y-3 pt-4 border-t border-border">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {selectedRFI.response ? 'Update Response' : 'Provide Response'}
                                        </p>
                                        <Textarea 
                                            placeholder="Type your response here..." 
                                            value={responseBody} 
                                            onChange={e => setResponseBody(e.target.value)}
                                            className="min-h-[100px] text-sm"
                                        />
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Response Attachments</label>
                                            <div className="flex flex-wrap gap-2">
                                                {responsePhotoPreviews.map((src, idx) => (
                                                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                                                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                                        <button 
                                                            onClick={() => removePhoto(idx, true)} 
                                                            className="absolute top-1 right-1 bg-destructive p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="h-2 w-2 text-white" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className="w-16 h-16 border-dashed border-2 border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                                    <input 
                                                        type="file" 
                                                        multiple 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        onChange={(e) => {
                                                            const files = Array.from(e.target.files || []);
                                                            setResponsePhotos(prev => [...prev, ...files]);
                                                            files.forEach(f => {
                                                                const r = new FileReader();
                                                                r.onload = () => setResponsePhotoPreviews(prev => [...prev, r.result as string]);
                                                                r.readAsDataURL(f);
                                                            });
                                                        }} 
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={handleUpdateResponse} 
                                            disabled={submitting || (!responseBody.trim() && responsePhotos.length === 0)}
                                            className="w-full bg-accent text-accent-foreground"
                                        >
                                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                                            Submit Response
                                        </Button>
                                    </div>
                                )}



                                {String(selectedRFI.assigned_to) === String(user?.id) && (
                                    <div className="pt-4 border-t border-border space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Update Status</p>
                                        <div className="flex gap-2">
                                            {(['open', 'closed', 'overdue'] as RFIStatus[]).map((s) => (
                                                <Button
                                                    key={s}
                                                    variant={selectedRFI.status === s ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={cn("flex-1 text-[10px] h-8", selectedRFI.status === s && STATUS_CONFIG[s].bg && STATUS_CONFIG[s].color && "opacity-100")}
                                                    onClick={() => handleStatusUpdate(selectedRFI.id, s)}
                                                >
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {annotatingIdx !== null && (
                <ImageAnnotator 
                    imageSrc={photoPreviews[annotatingIdx]} 
                    onSave={handleAnnotateSave} 
                    onCancel={() => setAnnotatingIdx(null)} 
                />
            )}

        {/* Photo Viewer */}
        <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
            <DialogContent className="max-w-2xl p-2 no-scrollbar">
                {viewPhoto && (
                    <img src={viewPhoto} alt="Preview" className="w-full h-auto rounded-lg" />
                )}
            </DialogContent>
        </Dialog>
    </div>
    );
}
