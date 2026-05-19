"use client";

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    X, Plus, MessageSquare, ImagePlus, ZoomIn, Loader2,
    AlertCircle, CheckCircle, AlertTriangle, Clock, User, Camera, Folder, CheckCheck
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
    updateRFI,
    getRFIById,
    markRFISeen
} from '@/services/rfiService';
import { getAssignees, Assignee } from '@/services/snagService';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import FolderPickerDialog from './FolderPickerDialog';
import VoiceNoteRecorder from '@/components/common/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/common/VoiceNotePlayer';

const isAudio = (url: string) => {
    if (!url) return false;
    try {
        const urlWithoutQuery = url.split('?')[0];
        return !!urlWithoutQuery.match(/\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i);
    } catch {
        return false;
    }
};

const isAudioFile = (file: File) => file.type.startsWith('audio/') || /\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i.test(file.name);

interface ProjectRFIProps {
    project: Project;
    onUpdate?: () => void;
}

const STATUS_CONFIG: Record<RFIStatus, { icon: any; color: string; bg: string; key: string }> = {
    open: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', key: 'open_status' },
    closed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-600/10', key: 'closed_status' },
    overdue: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', key: 'overdue_status' },
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
    const [newAudio, setNewAudio] = useState<File | null>(null);
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
    const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
    const [existingAudioKey, setExistingAudioKey] = useState<string | null>(null);
    const [responseBody, setResponseBody] = useState('');
    const [responsePhotos, setResponsePhotos] = useState<File[]>([]);
    const [responsePhotoPreviews, setResponsePhotoPreviews] = useState<string[]>([]);
    const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [removedResponsePhotos, setRemovedResponsePhotos] = useState<string[]>([]);
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [selectedFolderIds, setSelectedFolderIds] = useState<(string | number)[]>([]);

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

    useEffect(() => {
        if (selectedRFI) {
            setResponseBody(selectedRFI.response || '');
            setRemovedResponsePhotos([]);
            setResponsePhotos([]);
            setResponsePhotoPreviews([]);
        }
    }, [selectedRFI?.id]);

    const hasExistingFormAudio = !!existingAudioUrl && !audioPreview;
    const hasPendingResponseImage = responsePhotos.some(file => !isAudioFile(file));
    const hasPendingResponseAudio = responsePhotos.some(isAudioFile);
    const hasExistingResponseImage = !!selectedRFI?.responsePhotoUrls?.some(url => !isAudio(url));
    const hasExistingResponseAudio = !!selectedRFI?.responsePhotoUrls?.some(isAudio);

    useEffect(() => {
        if (selectedRFI && String(selectedRFI.assigned_to) === String(user?.id) && !selectedRFI.seen_at) {
            markRFISeen(selectedRFI.id).then(data => {
                setSelectedRFI(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
                setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, seen_at: data.seen_at } : r));
            }).catch(err => console.error("Failed to mark RFI as seen:", err));
        }
    }, [selectedRFI?.id, user?.id]);

    const load = async (silent = false) => {
        if (!project?.id) return;
        if (!silent) setLoading(true);
        try {
            const [rfiData, assigneeData] = await Promise.all([
                getRFIs(project.id as any),
                getRFIAssignees(project.id as any),
            ]);
            setRfis(rfiData);
            setAssignees(assigneeData);
        } catch (e) {
            toast.error(t('failed_load_rfis'));
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); }, [project?.id]);

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket || !project?.id) return;

        socket.emit('join-project', project.id);

        const onRFSeen = (data: { rfiId: number, seen_at: string }) => {
            setRfis(prev => prev.map(r => r.id === data.rfiId ? { ...r, seen_at: data.seen_at } : r));
            setSelectedRFI(prev => (prev && prev.id === data.rfiId) ? { ...prev, seen_at: data.seen_at } : prev);
        };

        const onRFIUpdated = (data: { rfi: RFI }) => {
            setRfis(prev => {
                const idx = prev.findIndex(r => r.id === data.rfi.id);
                if (idx !== -1) {
                    const copy = [...prev];
                    copy[idx] = data.rfi;
                    return copy;
                }
                return [data.rfi, ...prev];
            });
            setSelectedRFI(prev => (prev && prev.id === data.rfi.id) ? data.rfi : prev);
        };

        socket.on('rfi-seen', onRFSeen);
        socket.on('rfi-updated', onRFIUpdated);

        return () => {
            socket.off('rfi-seen', onRFSeen);
            socket.off('rfi-updated', onRFIUpdated);
        };
    }, [socket, project?.id]);

    useEffect(() => {
        if (initialRfiId) {
            const openRFI = (target: RFI) => {
                setSelectedRFI(target);
                // Clear the ID from URL to prevent loop on back navigation
                const params = new URLSearchParams(window.location.search);
                params.delete('rfiId');
                const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
            };

            const existing = rfis.find(r => String(r.id) === String(initialRfiId));
            if (existing) {
                openRFI(existing);
            } else {
                // Fetch specific RFI for faster redirection
                getRFIById(Number(initialRfiId)).then(openRFI).catch(() => {
                    // Fallback: clear param if fetch fails
                    const params = new URLSearchParams(window.location.search);
                    params.delete('rfiId');
                    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                    window.history.replaceState({}, '', newUrl);
                });
            }
        }
    }, [initialRfiId, rfis]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        if (validFiles.length !== files.length) toast.error(t('some_files_skipped_msg'));

        const total = newPhotos.length + validFiles.length;
        if (total > 4) {
            toast.error(t('max_4_photos_msg'));
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
        if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
        if (!newAssignee) { toast.error(t('assignee_required_msg')); return; }

        if (!checkLimit('rfis')) {
            toast.error(t('rfi_limit_msg'), {
                action: {
                    label: t('upgrade_label'),
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
            if (newAudio) form.append('photos', newAudio);
            if (selectedFolderIds.length > 0) {
                form.append('folder_ids', selectedFolderIds.join(','));
            }

            await createRFI(form);
            toast.success(t('rfi_created_msg'));
            setShowAdd(false);
            resetForm();
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_create_rfi')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateLinks = async (ids: (string | number)[]) => {
        if (!selectedRFI) return;
        setSubmitting(true);
        try {
            const numericIds = ids.map(Number);
            const form = new FormData();
            form.append('folder_ids', numericIds.join(','));
            const updated = await updateRFI(selectedRFI.id, form);
            setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, folder_ids: numericIds, linked_folders: updated.linked_folders } : r));
            setSelectedRFI(prev => prev ? { ...prev, folder_ids: numericIds, linked_folders: updated.linked_folders } : null);
            toast.success(t('links_updated_msg'));
            setShowFolderPicker(false);
        } catch (error) {
            toast.error(t('failed_update_links'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateRFI = async () => {
        if (!selectedRFI) return;
        if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('title', newTitle.trim());
            form.append('description', newDescription.trim());
            form.append('assigned_to', newAssignee);
            if (newExpiryDate) form.append('expiry_date', newExpiryDate);
            newPhotos.forEach(photo => form.append('photos', photo));
            if (newAudio) form.append('photos', newAudio);
            if (removedPhotos.length > 0) {
                form.append('removedPhotos', JSON.stringify(removedPhotos));
            }
            form.append('folder_ids', selectedFolderIds.join(','));

            const updated = await updateRFI(selectedRFI.id, form);
            toast.success(t('rfi_updated_msg'));
            setIsEditing(false);
            setRfis(prev => prev.map(r => r.id === selectedRFI.id ? updated : r));
            setSelectedRFI(updated);
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_update_rfi')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRFI = async (id: number) => {
        if (!confirm(t('confirm_delete_rfi'))) return;
        try {
            await deleteRFI(id);
            toast.success(t('rfi_deleted_msg'));
            setRfis(prev => prev.filter(r => r.id !== id));
            setSelectedRFI(null);
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_delete_rfi')));
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewDescription('');
        setNewAssignee('');
        setNewExpiryDate('');
        setNewPhotos([]);
        setPhotoPreviews([]);
        setNewAudio(null);
        setAudioPreview(null);
        setRemovedPhotos([]);
        setExistingAudioUrl(null);
        setExistingAudioKey(null);
        setSelectedFolderIds([]);
    };

    const handleUpdateResponse = async () => {
        if (!selectedRFI) return;
        setSubmitting(true);
        try {
            const form = new FormData();
            // Only append text response if non-empty; otherwise backend treats undefined
            // and won't overwrite an existing response with an empty string
            if (responseBody.trim()) {
                form.append('response', responseBody.trim());
            }
            responsePhotos.forEach(p => form.append('photos', p));
            if (removedResponsePhotos.length > 0) {
                form.append('removedPhotos', JSON.stringify(removedResponsePhotos));
            }
            
            const updated = await updateRFIResponse(selectedRFI.id, form);
            toast.success(t('response_updated_msg'));
            setRfis(prev => prev.map(r => r.id === selectedRFI.id ? updated : r));
            setSelectedRFI(updated);
            setResponseBody(updated.response || '');
            setResponsePhotos([]);
            setResponsePhotoPreviews([]);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_update_response')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: RFIStatus) => {
        try {
            await updateRFIStatus(id, status);
            toast.success(t('status_updated_to_msg').replace('{label}', t(STATUS_CONFIG[status].key)));
            
            // Update the list locally by only changing the status field
            setRfis(prev => prev.map(r => r.id === id ? { ...r, status } : r));
            
            if (onUpdate) onUpdate();
            
            // Update the selected RFI view if it's the one being modified
            if (selectedRFI?.id === id) {
                setSelectedRFI({ ...selectedRFI, status });
            }
        } catch {
            toast.error(t('failed_update_status'));
        }
    };

    const filteredRfis = rfis.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesCreator = creatorFilter === 'all' || String(r.created_by) === creatorFilter;
        const matchesAssignee = assigneeFilter === 'all' || String(r.assigned_to) === assigneeFilter;
        return matchesStatus && matchesCreator && matchesAssignee;
    });

    if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold">{t('request_for_info_title')}</h2>
                    <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> {t('new_rfi_btn')}
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-secondary/20 rounded-xl border border-border">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('status_label')}</label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_status')}</SelectItem>
                                <SelectItem value="open">{t('open_status')}</SelectItem>
                                <SelectItem value="overdue">{t('overdue_status')}</SelectItem>
                                <SelectItem value="closed">{t('closed_status')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('created_by_label')}</label>
                        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_creators_label')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_creators_label')}</SelectItem>
                                {Array.from(new Set(rfis.map(r => r.creator?.id))).filter(Boolean).map(id => {
                                    const name = rfis.find(r => r.creator?.id === id)?.creator?.name;
                                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('assigned_to_label')}</label>
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_assignees_label')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_assignees_label')}</SelectItem>
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
                                {t('clear_all_btn')}
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
                                                {t(cfg.key)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{rfi.description}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex flex-col items-end gap-1">
                                        <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                            <Clock className="h-3 w-3" /> {new Date(rfi.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border">
                                        <span className="text-[10px] font-bold">{rfi.creator?.name?.charAt(0)}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{t('by_user_label').replace('{name}', rfi.creator?.name || '')}</span>
                                </div>
                                {rfi.assignee && (
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3 text-accent" />
                                        <span className="text-[10px] font-medium text-accent">{t('assigned_to_user_label').replace('{name}', rfi.assignee.name)}</span>
                                    </div>
                                )}
                                {rfi.seen_at && (
                                    <div className="flex items-center gap-0.5 text-orange-500" title={`Seen at ${new Date(rfi.seen_at).toLocaleString()}`}>
                                        <CheckCheck className="h-3.5 w-3.5" />
                                        <span className="text-[8px] font-bold uppercase tracking-tighter">{t('seen_badge')}</span>
                                    </div>
                                )}
                                {rfi.photos && rfi.photos.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Camera className="h-3 w-3" />
                                        <span className="text-[10px]">{t('attachments_count_label').replace('{count}', String(rfi.photos.length))}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredRfis.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground font-medium">{t('no_rfis_found')}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{t('rfi_filter_empty_desc')}</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={showAdd || isEditing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setIsEditing(false); resetForm(); } }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? t('edit_rfi_title') : t('new_rfi_title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('title_label')}</label>
                            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('rfi_title_placeholder')} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('description_label')}</label>
                            <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder={t('rfi_context_placeholder')} className="min-h-[100px]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('assign_to_label')}</label>
                            <Select value={newAssignee} onValueChange={setNewAssignee}>
                                <SelectTrigger><SelectValue placeholder={t('select_assignee_placeholder')} /></SelectTrigger>
                                <SelectContent>
                                    {assignees.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('expiry_date_label')}</label>
                            <Input type="datetime-local" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('attachments_label')}</label>
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
                                {photoPreviews.length < 4 && (
                                    <label className="w-20 h-20 border-dashed border-2 border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('voice_note_label')}</label>
                            {audioPreview ? (
                                <div className="relative rounded-xl border border-border bg-card p-4 pr-10">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
                                    </div>
                                    <VoiceNotePlayer url={audioPreview} isMe={false} />
                                    <button onClick={() => { setNewAudio(null); setAudioPreview(null); }} className="absolute top-2 right-2 rounded-full bg-destructive/90 p-1.5">
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ) : hasExistingFormAudio ? (
                                <div className="relative rounded-xl border border-border bg-card p-4 pr-10">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
                                    </div>
                                    <VoiceNotePlayer url={existingAudioUrl!} isMe={false} />
                                    <button
                                        onClick={() => {
                                            if (existingAudioKey) setRemovedPhotos(prev => [...prev, existingAudioKey]);
                                            setExistingAudioUrl(null);
                                            setExistingAudioKey(null);
                                        }}
                                        className="absolute top-2 right-2 rounded-full bg-destructive/90 p-1.5"
                                    >
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <VoiceNoteRecorder
                                    onSend={(file) => {
                                        setNewAudio(file);
                                        setAudioPreview(URL.createObjectURL(file));
                                    }}
                                />
                            )}
                        </div>

                        {/* <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Link to Folders</label>
                            <div className="flex flex-wrap gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[10px]" 
                                    onClick={() => setShowFolderPicker(true)}
                                >
                                    <Folder className="h-3 w-3 mr-1.5" />
                                    {selectedFolderIds.length > 0 ? `Manage Folders (${selectedFolderIds.length})` : 'Select Folders'}
                                </Button>
                            </div>
                        </div> */}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setShowAdd(false); setIsEditing(false); resetForm(); }} disabled={submitting}>{t('cancel')}</Button>
                        <Button onClick={isEditing ? handleUpdateRFI : addRFI} disabled={submitting || !newTitle.trim()} className="bg-accent text-accent-foreground">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isEditing ? <CheckCircle className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />)}
                            {isEditing ? t('save_changes') : t('create_rfi_btn')}
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
                                            {t(STATUS_CONFIG[selectedRFI.status].key)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{t('rfi_id_label').replace('{id}', String(selectedRFI.id))}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(String(selectedRFI.created_by) === String(user?.id) || String(selectedRFI.creator?.id) === String(user?.id)) && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 text-[10px]"
                                                onClick={() => {
                                                    setSelectedFolderIds(selectedRFI.linked_folders?.map(f => f.id) || []);
                                                    setShowFolderPicker(true);
                                                }}
                                            >
                                                <Folder className="h-3 w-3 mr-1.5" />
                                                {t('link_btn')}
                                            </Button>
                                        )}
                                        {(String(selectedRFI.created_by) === String(user?.id) || String(selectedRFI.creator?.id) === String(user?.id)) && !selectedRFI.response && (
                                            <>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => {
                                                        setNewTitle(selectedRFI.title);
                                                        setNewDescription(selectedRFI.description || '');
                                                        setNewAssignee(String(selectedRFI.assigned_to));
                                                        setNewExpiryDate(selectedRFI.expiry_date ? new Date(selectedRFI.expiry_date).toISOString().slice(0, 16) : '');
                                                        const allAttachments = selectedRFI.photoDownloadUrls || [];
                                                        const imageAttachments = allAttachments.filter(url => !isAudio(url));
                                                        const audioAttachment = allAttachments.find(isAudio) || null;
                                                        const audioKeyIndex = allAttachments.findIndex(isAudio);
                                                        setPhotoPreviews(imageAttachments);
                                                        setNewPhotos([]);
                                                        setNewAudio(null);
                                                        setAudioPreview(null);
                                                        setRemovedPhotos([]);
                                                        setExistingAudioUrl(audioAttachment);
                                                        setExistingAudioKey(audioKeyIndex >= 0 ? (selectedRFI.photos?.[audioKeyIndex] || null) : null);
                                                        setSelectedFolderIds(selectedRFI.linked_folders?.map(f => f.id) || []);
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    {t('edit_btn')}
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => {
                                                        if (confirm(t('confirm_delete_rfi'))) {
                                                            deleteRFI(selectedRFI.id).then(() => {
                                                                setRfis(prev => prev.filter(r => r.id !== selectedRFI.id));
                                                                setSelectedRFI(null);
                                                                toast.success(t('rfi_deleted_msg'));
                                                            }).catch(() => toast.error(t('failed_delete_rfi')));
                                                        }
                                                    }}
                                                >
                                                    {t('delete_btn')}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <DialogTitle className="text-xl leading-tight">{selectedRFI.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <div>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedRFI.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('created_by_label')}</p>
                                        <p className="text-xs font-semibold">{selectedRFI.creator?.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedRFI.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('assigned_to_label')}</p>
                                        <p className="text-xs font-semibold">{selectedRFI.assignee?.name || t('unassigned_label')}</p>
                                    </div>
                                    {selectedRFI.expiry_date && (
                                        <div className="col-span-2 mt-2 pt-2 border-t border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('expiry_date_label')}</p>
                                            <p className={cn("text-xs font-semibold flex items-center gap-1.5", 
                                                selectedRFI.status === 'overdue' ? 'text-destructive' : 'text-foreground')}>
                                                <Clock className="h-3 w-3" />
                                                {new Date(selectedRFI.expiry_date).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {selectedRFI.linked_folders && selectedRFI.linked_folders.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('linked_folders_title')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRFI.linked_folders.map((f: any) => (
                                                <button 
                                                    key={f.id} 
                                                    onClick={() => {
                                                        setSelectedRFI(null);
                                                        const params = new URLSearchParams(window.location.search);
                                                        params.set('tab', f.folder_type === 'photo' ? 'photos' : 'documents');
                                                        params.set('folder', String(f.id));
                                                        router.push(`?${params.toString()}`);
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/5 border border-accent/10 text-[10px] font-semibold text-accent hover:bg-accent/10 transition-colors"
                                                >
                                                    <Folder className="h-2.5 w-2.5" />
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRFI.photoDownloadUrls && selectedRFI.photoDownloadUrls.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('attachments_label')}</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {selectedRFI.photoDownloadUrls.map((url, idx) => (
                                                isAudio(url) ? (
                                                    <div key={idx} className="col-span-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t('voice_attachment_label')}</span>
                                                        </div>
                                                        <VoiceNotePlayer url={url} isMe={false} />
                                                    </div>
                                                ) : (
                                                    <div key={idx} onClick={() => setViewPhoto(url)} className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all group cursor-pointer">
                                                        <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <ZoomIn className="h-5 w-5 text-white" />
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(selectedRFI.response || (selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0)) && (
                                    <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                                        <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">{t('response_title')}</p>
                                        {selectedRFI.response && <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{selectedRFI.response}</p>}
                                        {selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2">
                                                {selectedRFI.responsePhotoUrls.map((url, idx) => (
                                                    isAudio(url) ? (
                                                        <div key={idx} className="col-span-3 rounded-xl border border-accent/20 bg-card p-4 shadow-sm relative group">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                                                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">{t('voice_response_label')}</span>
                                                            </div>
                                                            <VoiceNotePlayer url={url} isMe={false} />
                                                            {String(selectedRFI.assigned_to) === String(user?.id) && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const key = selectedRFI.response_photos?.[idx];
                                                                        if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                                                        // Optimistic UI update
                                                                        const newUrls = [...(selectedRFI.responsePhotoUrls || [])];
                                                                        newUrls.splice(idx, 1);
                                                                        const newPhotos = [...(selectedRFI.response_photos || [])];
                                                                        newPhotos.splice(idx, 1);
                                                                        setSelectedRFI({ ...selectedRFI, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                                                    }}
                                                                    className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X className="h-3 w-3 text-white" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                                                            <img src={url} alt="Response photo" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewPhoto(url)} />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                <ZoomIn className="h-4 w-4 text-white" />
                                                            </div>
                                                            {String(selectedRFI.assigned_to) === String(user?.id) && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const key = selectedRFI.response_photos?.[idx];
                                                                        if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                                                        // Optimistic UI update
                                                                        const newUrls = [...(selectedRFI.responsePhotoUrls || [])];
                                                                        newUrls.splice(idx, 1);
                                                                        const newPhotos = [...(selectedRFI.response_photos || [])];
                                                                        newPhotos.splice(idx, 1);
                                                                        setSelectedRFI({ ...selectedRFI, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                                                    }}
                                                                    className="absolute top-1 right-1 bg-destructive/90 hover:bg-destructive p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X className="h-2 w-2 text-white" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {String(selectedRFI.assigned_to) === String(user?.id) && selectedRFI.status !== 'closed' && (
                                    <div className="space-y-3 pt-4 border-t border-border">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {(selectedRFI.response || (selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0)) ? t('update_response_title') : t('provide_response_title')}
                                        </p>
                                        <Textarea 
                                            placeholder={t('rfi_response_placeholder')} 
                                            value={responseBody} 
                                            onChange={e => setResponseBody(e.target.value)}
                                            className="min-h-[100px] text-sm"
                                        />
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('response_attachments_label')}</label>
                                            <div className="flex flex-wrap gap-2">
                                                {responsePhotoPreviews.map((src, idx) => {
                                                    const isAudioFile = responsePhotos[idx]?.type.startsWith('audio/');
                                                    return (
                                                        <div key={idx} className={`relative ${isAudioFile ? 'w-full max-w-md' : 'w-20 h-20'} rounded-xl overflow-hidden border border-border group bg-card shadow-sm hover:shadow-md transition-all`}>
                                                            {isAudioFile ? (
                                                                <div className="p-4 pr-10 flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                                                        <span className="text-[9px] font-bold text-accent uppercase tracking-tighter">{t('voice_response_label')}</span>
                                                                    </div>
                                                                    <VoiceNotePlayer url={src} isMe={false} />
                                                                </div>
                                                            ) : (
                                                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                                            )}
                                                            <button 
                                                                onClick={() => removePhoto(idx, true)} 
                                                                className={`absolute top-2 right-2 bg-destructive/90 hover:bg-destructive p-1.5 rounded-full shadow-sm ${isAudioFile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-10`}
                                                            >
                                                                <X className="h-3 w-3 text-white" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex items-center gap-2">
                                                    {!hasPendingResponseImage && !hasExistingResponseImage && (
                                                        <label className="w-16 h-16 border-dashed border-2 border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                                            <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                                            <input 
                                                                type="file" 
                                                                multiple 
                                                                accept="image/*" 
                                                                className="hidden" 
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files || []);
                                                                    if (files.length === 0) return;
                                                                    const file = files[0];
                                                                    setResponsePhotos(prev => [...prev.filter(isAudioFile), file]);
                                                                    const r = new FileReader();
                                                                    r.onload = () => {
                                                                        setResponsePhotoPreviews(prev => {
                                                                            const filtered = prev.filter((_, idx) => {
                                                                                const file = responsePhotos[idx];
                                                                                return file ? isAudioFile(file) : false;
                                                                            });
                                                                            return [...filtered, r.result as string];
                                                                        });
                                                                    };
                                                                    r.readAsDataURL(file);
                                                                }} 
                                                            />
                                                        </label>
                                                    )}
                                                    {!hasPendingResponseAudio && !hasExistingResponseAudio && (
                                                        <div className="flex items-center justify-center px-2">
                                                            <VoiceNoteRecorder 
                                                                onSend={(file) => {
                                                                    const url = URL.createObjectURL(file);
                                                                    setResponsePhotos(prev => [...prev.filter(f => !isAudioFile(f)), file]);
                                                                    setResponsePhotoPreviews(prev => {
                                                                        const filtered = prev.filter((_, idx) => {
                                                                            const existingFile = responsePhotos[idx];
                                                                            return existingFile ? !isAudioFile(existingFile) : false;
                                                                        });
                                                                        return [...filtered, url];
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={handleUpdateResponse} 
                                            disabled={submitting || (responseBody === (selectedRFI.response || '') && responsePhotos.length === 0 && removedResponsePhotos.length === 0)}
                                            className="w-full bg-accent text-accent-foreground"
                                        >
                                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                                            {t('submit_response_btn')}
                                        </Button>
                                    </div>
                                )}

                                {String(selectedRFI.assigned_to) === String(user?.id) && (
                                    <div className="pt-4 border-t border-border space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('update_status_title')}</p>
                                        <div className="flex gap-2">
                                            {(['open', 'closed', 'overdue'] as RFIStatus[]).map((s) => (
                                                <Button
                                                    key={s}
                                                    variant={selectedRFI.status === s ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={cn("flex-1 text-[10px] h-8", selectedRFI.status === s && STATUS_CONFIG[s].bg && STATUS_CONFIG[s].color && "opacity-100")}
                                                    onClick={() => handleStatusUpdate(selectedRFI.id, s)}
                                                >
                                                    {t(STATUS_CONFIG[s].key)}
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

        <FolderPickerDialog 
            open={showFolderPicker}
            onOpenChange={setShowFolderPicker}
            project={project}
            selectedFolderIds={selectedFolderIds}
            submitting={submitting}
            onSelect={async (ids) => {
                setSelectedFolderIds(ids);
                if (selectedRFI && !isEditing) {
                    await handleUpdateLinks(ids);
                } else {
                    setShowFolderPicker(false);
                }
            }}
        />
    </div>
    );
}
