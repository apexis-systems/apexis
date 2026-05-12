"use client";

import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Minus, Check, Plus, MessageSquare, ImagePlus, ZoomIn, Trash2, Loader2, CheckCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/helpers/apiError';
import {
  Snag, SnagStatus, Assignee,
  getSnags, createSnag, updateSnagStatus, deleteSnag, getAssignees,
  updateSnag, markSnagSeen
} from '@/services/snagService';
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

interface ProjectSnagListProps {
  project: Project;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SnagStatus, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  red: { icon: X, bg: 'bg-destructive', text: 'text-destructive-foreground', label: 'No Action Required' },
  amber: { icon: Minus, bg: 'bg-amber-500', text: 'text-white', label: 'Waiting for Clearance' },
  green: { icon: Check, bg: 'bg-green-600', text: 'text-white', label: 'Completed' },
};
const STATUS_CYCLE: SnagStatus[] = ['amber', 'green', 'red'];

const ProjectSnagList = ({ project, compact = false }: ProjectSnagListProps) => {
  const { user } = useAuth();
  const { checkLimit } = useUsage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSnagId = searchParams?.get('snagId');

  const [snags, setSnags] = useState<Snag[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | SnagStatus>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  
  const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [responseComment, setResponseComment] = useState('');
  const [responsePhotos, setResponsePhotos] = useState<File[]>([]);
  const [responsePhotoPreviews, setResponsePhotoPreviews] = useState<string[]>([]);
  const [removedResponsePhotos, setRemovedResponsePhotos] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const responseFileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [snagData, assigneeData] = await Promise.all([
        getSnags(project.id as any),
        getAssignees(project.id as any),
      ]);
      setSnags(snagData);
      setAssignees(assigneeData);
    } catch (e) {
      toast.error('Failed to load snags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project?.id]);

  useEffect(() => {
    if (selectedSnag) {
      setResponseComment(selectedSnag.response || '');
      setRemovedResponsePhotos([]);
      setResponsePhotos([]);
      setResponsePhotoPreviews([]);
    }
  }, [selectedSnag?.id]);

  const hasExistingSnagAudio = isEditing && !!selectedSnag?.audioDownloadUrl && !removeExistingAudio && !audioPreview;
  const hasPendingResponseImage = responsePhotos.some(file => !isAudioFile(file));
  const hasPendingResponseAudio = responsePhotos.some(isAudioFile);
  const hasExistingResponseImage = !!selectedSnag?.responsePhotoUrls?.some(url => !isAudio(url));
  const hasExistingResponseAudio = !!selectedSnag?.responsePhotoUrls?.some(isAudio);

  useEffect(() => {
    if (selectedSnag && String(selectedSnag.assigned_to) === String(user?.id) && !selectedSnag.seen_at) {
      markSnagSeen(selectedSnag.id).then(data => {
        setSelectedSnag(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
        setSnags(prev => prev.map(s => s.id === selectedSnag.id ? { ...s, seen_at: data.seen_at } : s));
      }).catch(err => console.error("Failed to mark snag as seen:", err));
    }
  }, [selectedSnag?.id, user?.id]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !project?.id) return;

    socket.emit('join-project', project.id);

    const onSnagSeen = (data: { snagId: number, seen_at: string }) => {
      setSnags(prev => prev.map(s => s.id === data.snagId ? { ...s, seen_at: data.seen_at } : s));
      setSelectedSnag(prev => (prev && prev.id === data.snagId) ? { ...prev, seen_at: data.seen_at } : prev);
    };

    const onSnagUpdated = (data: { snag: Snag }) => {
      setSnags(prev => {
        const idx = prev.findIndex(s => s.id === data.snag.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = data.snag;
          return copy;
        }
        return [data.snag, ...prev];
      });
      setSelectedSnag(prev => (prev && prev.id === data.snag.id) ? data.snag : prev);
    };

    socket.on('snag-seen', onSnagSeen);
    socket.on('snag-updated', onSnagUpdated);

    return () => {
      socket.off('snag-seen', onSnagSeen);
      socket.off('snag-updated', onSnagUpdated);
    };
  }, [socket, project?.id]);

  // ── Status cycle ────────────────────────────────────────────────────────────

  const cycleStatus = async (snag: Snag, nextStatus?: SnagStatus, comment?: string, files?: File[], removedPhotos?: string[]) => {
    const idx = STATUS_CYCLE.indexOf(snag.status);
    const next = nextStatus || STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const prevStatus = snag.status;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('status', next);
      if (comment) form.append('response', comment);
      if (files) files.forEach(f => form.append('photos', f));
      if (removedPhotos && removedPhotos.length > 0) {
        form.append('removedPhotos', JSON.stringify(removedPhotos));
      }

      const updated = await updateSnagStatus(snag.id, form);
      setSnags(prev => prev.map(s => s.id === snag.id ? updated : s));
      setSelectedSnag(updated);
      
      toast.success(`Status updated to ${STATUS_CONFIG[next].label}`);
      setResponseComment(updated.response || '');
      setResponsePhotos([]);
      setResponsePhotoPreviews([]);
      setRemovedResponsePhotos([]);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Photo pick ──────────────────────────────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setNewPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Add snag ────────────────────────────────────────────────────────────────

  const addSnag = async () => {
    if (!newTitle.trim()) { toast.error('Title is required'); return; }
    if (!newAssignee) { toast.error('Assignee is required'); return; }
    if (!newPhoto) { toast.error('Photo is required'); return; }

    if (!checkLimit('snags')) {
      toast.error("Limit Reached: You have reached your snag limit. Please upgrade your plan to add more snags.", {
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
      if (newDescription.trim()) form.append('description', newDescription.trim());
      if (newAssignee) form.append('assigned_to', newAssignee);
      if (newPhoto) form.append('photo', newPhoto);
      if (newAudio) form.append('audio', newAudio);

      const snag = await createSnag(form);
      setSnags(prev => [snag, ...prev]);
      setNewTitle(''); setNewDescription(''); setNewAssignee('');
      setNewPhoto(null); setPhotoPreview(null); setNewAudio(null); setAudioPreview(null);
      setShowAdd(false);
      toast.success('Snag added');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to add snag'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSnag = async () => {
    if (!selectedSnag) return;
    if (!newTitle.trim()) { toast.error('Title is required'); return; }
    
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', newTitle.trim());
      if (newDescription.trim()) form.append('description', newDescription.trim());
      if (newAssignee) form.append('assigned_to', newAssignee);
      if (newPhoto) form.append('photo', newPhoto);
      if (newAudio) form.append('audio', newAudio);
      if (removeExistingAudio) form.append('remove_audio', 'true');

      const updated = await updateSnag(selectedSnag.id, form);
      setSnags(prev => prev.map(s => s.id === selectedSnag.id ? updated : s));
      setSelectedSnag(updated);
      setNewAudio(null);
      setAudioPreview(null);
      setRemoveExistingAudio(false);
      setIsEditing(false);
      toast.success('Snag updated');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update snag'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (snag: Snag) => {
    if (!confirm(`Delete "${snag.title}"?`)) return;
    try {
      await deleteSnag(snag.id);
      setSnags(prev => prev.filter(s => s.id !== snag.id));
      toast.success('Snag deleted');
    } catch { toast.error('Failed to delete snag'); }
  };

  const filteredSnags = snags.filter(s => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesCreator = creatorFilter === 'all' || String(s.created_by) === creatorFilter;
    const matchesAssignee = assigneeFilter === 'all' || String(s.assigned_to) === assigneeFilter;
    return matchesStatus && matchesCreator && matchesAssignee;
  });

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;
  if (!project) return null;

  return (
    <div className={cn(compact ? '' : 'mt-3')}>
      {!compact && (
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Project Snags</h2>
            <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-9">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Snag
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
                  <SelectItem value="amber">Waiting for Clearance</SelectItem>
                  <SelectItem value="green">Completed</SelectItem>
                  <SelectItem value="red">No Action Required</SelectItem>
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
                  {Array.from(new Set(snags.map(s => s.creator?.id))).filter(Boolean).map(id => {
                    const name = snags.find(s => s.creator?.id === id)?.creator?.name;
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
                  {Array.from(new Set(snags.map(s => s.assignee?.id))).filter(Boolean).map(id => {
                    const name = snags.find(s => s.assignee?.id === id)?.assignee?.name;
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
      )}

      <div className="space-y-2">
        {filteredSnags.map((snag) => {
          const cfg = STATUS_CONFIG[snag.status];
          const Icon = cfg.icon;
          const photoUrl = snag.photoDownloadUrl || snag.photo_url;
          const isTarget = initialSnagId && String(snag.id) === String(initialSnagId);
          return (
            <div 
              key={snag.id} 
              onClick={() => setSelectedSnag(snag)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer hover:border-accent/50",
                isTarget ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border bg-card"
              )}
            >
              {/* Status circle */}
              <button
                onClick={() => {
                  if (String(snag.assigned_to) === String(user?.id)) {
                    // Pre-fill response when clicking status circle if needed? 
                    // Actually cycleStatus clears it anyway, so we just call it.
                    cycleStatus(snag);
                  } else {
                    toast.error('Only the assigned person can update the status');
                  }
                }}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5 transition-all',
                  cfg.bg,
                  String(snag.assigned_to) !== String(user?.id) && "opacity-60 cursor-not-allowed"
                )}
                title={String(snag.assigned_to) === String(user?.id) ? `Status: ${cfg.label} — click to change` : `Status: ${cfg.label}`}
              >
                <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{snag.title}</p>
                {snag.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{snag.description}</p>
                )}
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                  <span>To: <span className="text-foreground font-medium">{snag.assignee?.name || '—'}</span></span>
                  <span>By: <span className="text-foreground font-medium">{snag.creator?.name || '—'}</span></span>
                  <span>· {cfg.label}</span>
                  {snag.seen_at && (
                    <span className="flex items-center gap-0.5 text-orange-500 font-bold uppercase tracking-tighter ml-1">
                      <CheckCheck className="h-2.5 w-2.5" /> Seen
                    </span>
                  )}
                </div>
                {snag.response && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground bg-accent/5 p-1 rounded">
                    <MessageSquare className="h-2.5 w-2.5 text-accent" />
                    <span className="truncate">{snag.response}</span>
                    {snag.responsePhotoUrls && snag.responsePhotoUrls.length > 0 && (
                      <span className="text-accent font-bold ml-1">+{snag.responsePhotoUrls.length} photos</span>
                    )}
                  </div>
                )}
              </div>

              {/* Photo thumbnail */}
              {photoUrl && (
                <button
                  onClick={() => setViewPhoto(photoUrl)}
                  className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden border border-border group"
                >
                  <img src={photoUrl} alt="Snag" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white" />
                  </div>
                </button>
              )}


            </div>
          );
        })}
      </div>

      {filteredSnags.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground font-medium">No snags found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try changing your filters or add a new snag</p>
        </div>
      )}

      {/* Add/Edit Snag Dialog */}
      <Dialog open={showAdd || isEditing} onOpenChange={(open) => {
        if (!open) {
          setNewPhoto(null); setPhotoPreview(null); setNewAudio(null); setAudioPreview(null); setRemoveExistingAudio(false);
          setNewTitle(''); setNewDescription(''); setNewAssignee('');
          setShowAdd(false); setIsEditing(false);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{isEditing ? 'Edit Snag' : 'Add Snag'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

            {/* Photo area — preview at top if selected, otherwise a compact picker button */}
            {photoPreview ? (
              <div className="relative w-full h-44 rounded-lg overflow-hidden border border-border">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setNewPhoto(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 hover:bg-black/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] rounded-full px-2.5 py-1 hover:bg-black/80 transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-5 cursor-pointer hover:border-accent/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-8 w-8 mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">Click to attach photo</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Required — JPG, PNG, etc.</p>
              </div>
            )}

            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Snag title *" maxLength={200} />
            <Textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="min-h-[56px] text-xs"
              maxLength={500}
            />

            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Assign to... *" /></SelectTrigger>
              <SelectContent>
                {assignees.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name} {a.role ? `(${a.role.charAt(0).toUpperCase() + a.role.slice(1)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Voice Note</p>
              {audioPreview ? (
                <div className="relative rounded-xl border border-border bg-card p-3 pr-10">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Voice Note</span>
                  </div>
                  <VoiceNotePlayer url={audioPreview} isMe={false} />
                  <button
                    onClick={() => { setNewAudio(null); setAudioPreview(null); }}
                    className="absolute right-2 top-2 rounded-full bg-destructive/90 p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : hasExistingSnagAudio ? (
                <div className="relative rounded-xl border border-border bg-card p-3 pr-10">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Voice Note</span>
                  </div>
                  <VoiceNotePlayer url={selectedSnag!.audioDownloadUrl!} isMe={false} />
                  <button
                    onClick={() => setRemoveExistingAudio(true)}
                    className="absolute right-2 top-2 rounded-full bg-destructive/90 p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <VoiceNoteRecorder
                  onSend={(file) => {
                    setNewAudio(file);
                    setAudioPreview(URL.createObjectURL(file));
                    setRemoveExistingAudio(false);
                  }}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setIsEditing(false); setNewAudio(null); setAudioPreview(null); setRemoveExistingAudio(false); }} disabled={submitting}>Cancel</Button>
            <Button onClick={isEditing ? handleUpdateSnag : addSnag} disabled={submitting || !newTitle.trim() || (!isEditing && !newPhoto) || !newAssignee} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isEditing ? 'Save Changes' : 'Add Snag')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snag Detail Dialog */}
      <Dialog open={!!selectedSnag} onOpenChange={(open) => !open && setSelectedSnag(null)}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh] no-scrollbar">
          {selectedSnag && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between mb-2 pr-8">
                  <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_CONFIG[selectedSnag.status].bg, STATUS_CONFIG[selectedSnag.status].text)}>
                    {STATUS_CONFIG[selectedSnag.status].label}
                  </div>
                  {(String(selectedSnag.created_by) === String(user?.id) || String(selectedSnag.creator?.id) === String(user?.id)) && !selectedSnag.response && (
                    <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px]"
                          onClick={() => {
                            setNewTitle(selectedSnag.title);
                            setNewDescription(selectedSnag.description || '');
                            setNewAssignee(String(selectedSnag.assigned_to));
                            setNewPhoto(null);
                            setPhotoPreview(selectedSnag.photoDownloadUrl || selectedSnag.photo_url || null);
                            setNewAudio(null);
                            setAudioPreview(null);
                            setRemoveExistingAudio(false);
                            setIsEditing(true);
                          }}
                        >
                          Edit
                        </Button>

                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-7 text-[10px]"
                        onClick={() => {
                          handleDelete(selectedSnag);
                          setSelectedSnag(null);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <DialogTitle className="text-lg">{selectedSnag.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {selectedSnag.photoDownloadUrl && (
                  <div className="aspect-video rounded-lg overflow-hidden border border-border cursor-pointer" onClick={() => setViewPhoto(selectedSnag.photoDownloadUrl || null)}>
                    <img src={selectedSnag.photoDownloadUrl} alt="Snag" className="w-full h-full object-cover" />
                  </div>
                )}

                {(selectedSnag.audioDownloadUrl || selectedSnag.audio_url) && (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-accent" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Voice Note</span>
                    </div>
                    <VoiceNotePlayer url={selectedSnag.audioDownloadUrl || selectedSnag.audio_url!} isMe={false} />
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>{selectedSnag.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/20 rounded-lg border border-border text-[10px]">
                  <div>
                    <p className="font-bold text-muted-foreground uppercase">Assigned To</p>
                    <p className="font-medium">{selectedSnag.assignee?.name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted-foreground uppercase">Created By</p>
                    <p className="font-medium">{selectedSnag.creator?.name || '—'}</p>
                  </div>
                </div>

                {(selectedSnag.response || (selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0)) && (
                  <div className="p-3 bg-accent/5 rounded-lg border border-accent/10">
                    <p className="text-[10px] font-bold text-accent uppercase mb-1">Last Response</p>
                    {selectedSnag.response && <p className="text-xs">{selectedSnag.response}</p>}
                    {selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {selectedSnag.responsePhotoUrls.map((url, i) => (
                          isAudio(url) ? (
                            <div key={i} className="col-span-3 p-3 rounded-lg border border-border bg-card relative group">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Voice Response</span>
                              </div>
                              <VoiceNotePlayer url={url} isMe={false} />
                              {String(selectedSnag.assigned_to) === String(user?.id) && (
                                <button 
                                  onClick={() => {
                                    const key = selectedSnag.response_photos?.[i];
                                    if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                    const newUrls = [...(selectedSnag.responsePhotoUrls || [])];
                                    newUrls.splice(i, 1);
                                    const newPhotos = [...(selectedSnag.response_photos || [])];
                                    newPhotos.splice(i, 1);
                                    setSelectedSnag({ ...selectedSnag, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                  }}
                                  className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive p-1.5 rounded-full shadow-sm opacity-100 transition-opacity z-10"
                                >
                                  <X className="h-3 w-3 text-white" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div key={i} className="relative aspect-square rounded border border-border overflow-hidden group">
                              <img src={url} alt="Response" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewPhoto(url)} />
                              {String(selectedSnag.assigned_to) === String(user?.id) && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = selectedSnag.response_photos?.[i];
                                    if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                    const newUrls = [...(selectedSnag.responsePhotoUrls || [])];
                                    newUrls.splice(i, 1);
                                    const newPhotos = [...(selectedSnag.response_photos || [])];
                                    newPhotos.splice(i, 1);
                                    setSelectedSnag({ ...selectedSnag, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                  }}
                                  className="absolute top-1 right-1 bg-destructive/90 hover:bg-destructive p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <X className="h-3 w-3 text-white" />
                                </button>
                              )}
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Respond Section */}
                {String(selectedSnag.assigned_to) === String(user?.id) && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Update Status & Respond</p>
                    <div className="flex gap-2">
                      {STATUS_CYCLE.map(s => (
                        <Button 
                          key={s} 
                          size="sm" 
                          variant={selectedSnag.status === s ? 'default' : 'outline'}
                          className={cn("flex-1 text-[10px] h-8", selectedSnag.status === s && STATUS_CONFIG[s].bg && STATUS_CONFIG[s].text)}
                          onClick={() => cycleStatus(selectedSnag, s, responseComment, responsePhotos, removedResponsePhotos)}
                        >
                          {STATUS_CONFIG[s].label.split(' ')[0]}
                        </Button>
                      ))}
                    </div>
                    <Textarea 
                      placeholder="Add a comment..." 
                      className="text-xs min-h-[60px]" 
                      value={responseComment}
                      onChange={e => setResponseComment(e.target.value)}
                    />
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {responsePhotoPreviews.map((src, i) => {
                          const isAudioFile = responsePhotos[i]?.type.startsWith('audio/');
                          return (
                            <div key={i} className={`relative ${isAudioFile ? 'w-full max-w-sm' : 'w-12 h-12'} rounded border border-border overflow-hidden group bg-card`}>
                              {isAudioFile ? (
                                <div className="p-2 pr-8 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    <span className="text-[8px] font-bold text-accent uppercase tracking-tighter">Voice Response</span>
                                  </div>
                                  <VoiceNotePlayer url={src} isMe={false} />
                                </div>
                              ) : (
                                <img src={src} className="w-full h-full object-cover" />
                              )}
                              <button 
                                onClick={() => {
                                  setResponsePhotos(prev => prev.filter((_, idx) => idx !== i));
                                  setResponsePhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                className={`absolute top-1 right-1 bg-destructive/90 hover:bg-destructive p-1 rounded-full shadow-sm ${isAudioFile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-10`}
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2">
                          {!hasPendingResponseImage && !hasExistingResponseImage && (
                            <button 
                              className="w-12 h-12 border-2 border-dashed border-border rounded flex items-center justify-center hover:border-accent/50 transition-colors"
                              onClick={() => responseFileInputRef.current?.click()}
                            >
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}
                          {!hasPendingResponseAudio && !hasExistingResponseAudio && (
                            <div className="flex items-center justify-center">
                              <VoiceNoteRecorder 
                                onSend={(file) => {
                                  const url = URL.createObjectURL(file);
                                  setResponsePhotos(prev => [...prev.filter(f => !isAudioFile(f)), file]);
                                  setResponsePhotoPreviews(prev => [...prev.filter((_, idx) => {
                                    const existingFile = responsePhotos[idx];
                                    return existingFile ? !isAudioFile(existingFile) : false;
                                  }), url]);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <input 
                        ref={responseFileInputRef} 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          const file = files[0];
                          
                          setResponsePhotos(prev => {
                            const filtered = prev.filter(isAudioFile);
                            return [...filtered, file];
                          });

                          const r = new FileReader();
                          r.onload = () => {
                            setResponsePhotoPreviews(prev => {
                              const filtered = prev.filter(p => p.startsWith('blob:'));
                              return [...filtered, r.result as string];
                            });
                          };
                          r.readAsDataURL(file);
                        }}
                      />
                    </div>
                    <Button 
                      className="w-full text-xs h-9 bg-accent hover:bg-accent/90" 
                      onClick={() => cycleStatus(selectedSnag, selectedSnag.status, responseComment, responsePhotos, removedResponsePhotos)}
                      disabled={submitting || (responseComment === (selectedSnag.response || '') && responsePhotos.length === 0 && removedResponsePhotos.length === 0)}
                    >
                      {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <MessageSquare className="h-3 w-3 mr-2" />}
                      Post Response
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-lg p-2">
          {viewPhoto && <img src={viewPhoto} alt="Snag detail" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectSnagList;
