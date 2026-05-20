"use client";

import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Minus, Check, Plus, MessageSquare, ImagePlus, ZoomIn, Trash2, Loader2, CheckCheck, CheckCircle2, Link2, Folder, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import FolderPickerDialog from './FolderPickerDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiErrorMessage } from '@/helpers/apiError';
import {
  Snag, SnagStatus, Assignee, ConversationMessage,
  getSnags, createSnag, updateSnagStatus, deleteSnag, getAssignees,
  updateSnag, markSnagSeen, getSnagMessages, sendSnagMessage
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

const mergeUniqueMessages = (messages: ConversationMessage[]) => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const idStr = String(message.id);
    if (seen.has(idStr)) return false;
    seen.add(idStr);
    return true;
  });
};

interface ProjectSnagListProps {
  project: Project;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SnagStatus, { icon: React.ElementType; bg: string; text: string; key: string }> = {
  red: { icon: X, bg: 'bg-destructive', text: 'text-destructive-foreground', key: 'no_action_required' },
  amber: { icon: Minus, bg: 'bg-amber-500', text: 'text-white', key: 'waiting_clearance' },
  green: { icon: Check, bg: 'bg-green-600', text: 'text-white', key: 'completed_status' },
};
const STATUS_CYCLE: SnagStatus[] = ['amber', 'green', 'red'];

const ProjectSnagList = ({ project, compact = false }: ProjectSnagListProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [messagePreview, setMessagePreview] = useState<string | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [snagData, assigneeData] = await Promise.all([
        getSnags(project.id),
        getAssignees(project.id),
      ]);
      setSnags(snagData);
      setAssignees(assigneeData);
    } catch (e) {
      toast.error(t('failed_load_snags'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project?.id]);

  useEffect(() => {
    if (initialSnagId && !loading) {
      const target = snags.find(s => String(s.id) === String(initialSnagId));
      if (target) {
        setSelectedSnag(target);
      }
      // Clear the ID from URL to prevent loop on back navigation
      const params = new URLSearchParams(window.location.search);
      params.delete('snagId');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
  }, [initialSnagId, snags, loading]);

  const hasExistingSnagAudio = isEditing && !!selectedSnag?.audioDownloadUrl && !removeExistingAudio && !audioPreview;
  const isConversationParticipant = !!selectedSnag && (
    String(selectedSnag.assigned_to) === String(user?.id) ||
    String(selectedSnag.created_by) === String(user?.id) ||
    String(selectedSnag.creator?.id) === String(user?.id)
  );
  const isConversationClosed = selectedSnag?.status === 'green';

  useEffect(() => {
    if (selectedSnag && String(selectedSnag.assigned_to) === String(user?.id) && !selectedSnag.seen_at) {
      markSnagSeen(selectedSnag.id).then(data => {
        setSelectedSnag(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
        setSnags(prev => prev.map(s => s.id === selectedSnag.id ? { ...s, seen_at: data.seen_at } : s));
      }).catch(err => console.error("Failed to mark snag as seen:", err));
    }
  }, [selectedSnag?.id, user?.id]);

  useEffect(() => {
    if (!selectedSnag) {
      setConversationMessages([]);
      setMessageText('');
      setMessageFile(null);
      setMessagePreview(null);
      return;
    }

    setLoadingMessages(true);
    getSnagMessages(selectedSnag.id)
      .then(messages => setConversationMessages(mergeUniqueMessages(messages)))
      .catch(() => toast.error(t('failed_update_status')))
      .finally(() => setLoadingMessages(false));
  }, [selectedSnag?.id]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (!loadingMessages) {
      setTimeout(scrollToBottom, 100);
    }
  }, [conversationMessages, loadingMessages]);

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

    const onConversationMessage = (data: { itemType: 'rfi' | 'snag', itemId: number, message: ConversationMessage }) => {
      if (data.itemType !== 'snag') return;
      setConversationMessages(prev => {
        if (!selectedSnag || selectedSnag.id !== data.itemId) return prev;
        return mergeUniqueMessages([...prev, data.message]);
      });
    };

    const onSnagDeleted = (data: { snagId: number }) => {
      setSnags(prev => prev.filter(s => s.id !== data.snagId));
      setSelectedSnag(prev => (prev && prev.id === data.snagId) ? null : prev);
    };

    socket.on('snag-seen', onSnagSeen);
    socket.on('snag-updated', onSnagUpdated);
    socket.on('snag-deleted', onSnagDeleted);
    socket.on('snag-conversation-message', onConversationMessage);

    return () => {
      socket.off('snag-seen', onSnagSeen);
      socket.off('snag-updated', onSnagUpdated);
      socket.off('snag-deleted', onSnagDeleted);
      socket.off('snag-conversation-message', onConversationMessage);
    };
  }, [socket, project?.id, selectedSnag?.id]);

  // ── Status cycle ────────────────────────────────────────────────────────────

  const cycleStatus = async (snag: Snag, nextStatus?: SnagStatus) => {
    const idx = STATUS_CYCLE.indexOf(snag.status);
    const next = nextStatus || STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('status', next);

      const updated = await updateSnagStatus(snag.id, form);
      setSnags(prev => prev.map(s => s.id === snag.id ? updated : s));
      setSelectedSnag(updated);
      
      toast.success(t('status_updated_to_msg').replace('{label}', t(STATUS_CONFIG[next].key)));
    } catch (error) {
      toast.error(t('failed_update_status'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedSnag) return;
    if (!messageText.trim() && !messageFile) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      if (messageText.trim()) form.append('text', messageText.trim());
      if (messageFile) form.append('file', messageFile);
      const message = await sendSnagMessage(selectedSnag.id, form);
      setConversationMessages(prev => mergeUniqueMessages([...prev, message]));
      setMessageText('');
      setMessageFile(null);
      setMessagePreview(null);
    } catch (error) {
      toast.error(t('failed_update_status'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isAllowed = file.type.startsWith('image/') || file.type.startsWith('audio/');
    if (!isAllowed) {
      toast.error('Only image and audio attachments are supported');
      return;
    }
    setMessageFile(file);
    setMessagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  // ── Photo pick ──────────────────────────────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('select_image_file_msg')); return; }
    setNewPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Add snag ────────────────────────────────────────────────────────────────

  const addSnag = async () => {
    if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
    if (!newAssignee) { toast.error(t('assignee_required_msg')); return; }
    if (!newPhoto) { toast.error(t('photo_required_msg')); return; }

    if (!checkLimit('snags')) {
      toast.error(t('snag_limit_msg'), {
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
      if (newDescription.trim()) form.append('description', newDescription.trim());
      if (newAssignee) form.append('assigned_to', newAssignee);
      if (newPhoto) form.append('photo', newPhoto);
      if (newAudio) form.append('audio', newAudio);

      const snag = await createSnag(form);
      setSnags(prev => [snag, ...prev]);
      setNewTitle(''); setNewDescription(''); setNewAssignee('');
      setNewPhoto(null); setPhotoPreview(null); setNewAudio(null); setAudioPreview(null);
      setShowAdd(false);
      toast.success(t('snag_added_msg'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('failed_add_snag')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSnag = async () => {
    if (!selectedSnag) return;
    if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
    
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
      toast.success(t('snag_updated_msg'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('failed_update_snag')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLinks = async (ids: (string | number)[]) => {
    if (!selectedSnag) return;
    setSubmitting(true);
    try {
      const numericIds = ids.map(Number);
      const form = new FormData();
      form.append('folder_ids', numericIds.join(','));
      const updated = await updateSnag(selectedSnag.id, form);
      setSnags(prev => prev.map(s => s.id === selectedSnag.id ? { ...s, folder_ids: numericIds, linked_folders: updated.linked_folders } : s));
      setSelectedSnag(prev => prev ? { ...prev, folder_ids: numericIds, linked_folders: updated.linked_folders } : null);
      toast.success(t('links_updated_msg'));
      setShowFolderPicker(false);
    } catch (error) {
      toast.error(t('failed_update_links') || 'Failed to update folder links');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (snag: Snag) => {
    if (!confirm(t('confirm_delete_snag').replace('{title}', snag.title))) return;
    try {
      await deleteSnag(snag.id);
      setSnags(prev => prev.filter(s => s.id !== snag.id));
      toast.success(t('snag_deleted_msg'));
    } catch { toast.error(t('failed_delete_snag')); }
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
            <h2 className="text-lg font-bold">{t('project_snags_title')}</h2>
            <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-9">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {t('add_snag_btn')}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-secondary/20 rounded-xl border border-border">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('status_label')}</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | SnagStatus)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={t('all_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="amber">{t('waiting_clearance')}</SelectItem>
                  <SelectItem value="green">{t('completed_status')}</SelectItem>
                  <SelectItem value="red">{t('no_action_required')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('created_by_label')}</label>
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={t('all_creators')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_creators')}</SelectItem>
                  {Array.from(new Set(snags.map(s => s.creator?.id))).filter(Boolean).map(id => {
                    const name = snags.find(s => s.creator?.id === id)?.creator?.name;
                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('assigned_to_label')}</label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={t('all_assignees')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_assignees')}</SelectItem>
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
                  {t('clear_all_btn')}
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
                    toast.error(t('only_assignee_update_msg'));
                  }
                }}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5 transition-all',
                  cfg.bg,
                  String(snag.assigned_to) !== String(user?.id) && "opacity-60 cursor-not-allowed"
                )}
                title={String(snag.assigned_to) === String(user?.id) ? t('status_click_change_tip').replace('{label}', t(cfg.key)) : t('status_tip').replace('{label}', t(cfg.key))}
              >
                <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{snag.title}</p>
                {snag.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{snag.description}</p>
                )}
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                  <span>{t('to_label')} <span className="text-foreground font-medium">{snag.assignee?.name || '—'}</span></span>
                  <span>{t('by_label')} <span className="text-foreground font-medium">{snag.creator?.name || '—'}</span></span>
                  <span>· {t(cfg.key)}</span>
                  {snag.seen_at && (
                    <span className="flex items-center gap-0.5 text-orange-500 font-bold uppercase tracking-tighter ml-1">
                      <CheckCheck className="h-2.5 w-2.5" /> {t('seen_badge')}
                    </span>
                  )}
                </div>
                {snag.response && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground bg-accent/5 p-1 rounded">
                    <MessageSquare className="h-2.5 w-2.5 text-accent" />
                    <span className="truncate">{snag.response}</span>
                    {snag.responsePhotoUrls && snag.responsePhotoUrls.length > 0 && (
                      <span className="text-accent font-bold ml-1">+{t('photos_count_label').replace('{count}', String(snag.responsePhotoUrls.length))}</span>
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
          <p className="text-sm text-muted-foreground font-medium">{t('no_snags_found')}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t('snag_filter_empty_desc')}</p>
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
            <DialogTitle className="text-sm">{isEditing ? t('edit_snag_title') : t('add_snag_title')}</DialogTitle>
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
                  {t('change_btn')}
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-5 cursor-pointer hover:border-accent/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-8 w-8 mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">{t('click_attach_photo')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t('photo_format_hint')}</p>
              </div>
            )}

            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('snag_title_placeholder')} maxLength={200} />
            <Textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder={t('description_optional')}
              className="min-h-[56px] text-xs"
              maxLength={500}
            />

            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="text-xs"><SelectValue placeholder={t('assign_to_placeholder')} /></SelectTrigger>
              <SelectContent>
                {assignees.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name} {a.role ? `(${a.role.charAt(0).toUpperCase() + a.role.slice(1)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">{t('voice_note_label')}</p>
              {audioPreview ? (
                <div className="relative rounded-xl border border-border bg-card p-3 pr-10">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
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
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
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
            <Button variant="outline" onClick={() => { setShowAdd(false); setIsEditing(false); setNewAudio(null); setAudioPreview(null); setRemoveExistingAudio(false); }} disabled={submitting}>{t('cancel')}</Button>
            <Button onClick={isEditing ? handleUpdateSnag : addSnag} disabled={submitting || !newTitle.trim() || (!isEditing && !newPhoto) || !newAssignee} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isEditing ? t('save_changes') : t('add_snag_btn'))}
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
                    {t(STATUS_CONFIG[selectedSnag.status].key)}
                  </div>
                  {(user?.role === 'admin' || user?.role === 'superadmin' || String(selectedSnag.created_by) === String(user?.id) || String(selectedSnag.creator?.id) === String(user?.id)) && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px]"
                        onClick={() => {
                          setSelectedFolderIds(selectedSnag.folder_ids || []);
                          setShowFolderPicker(true);
                        }}
                      >
                        <Folder className="h-3 w-3 mr-1.5" />
                        {t('link_btn')}
                      </Button>
                      {!selectedSnag.response && (
                        <>
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
                            {t('edit_btn')}
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
                            {t('delete_btn')}
                          </Button>
                        </>
                      )}
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
                      <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
                    </div>
                    <VoiceNotePlayer url={selectedSnag.audioDownloadUrl || selectedSnag.audio_url!} isMe={false} />
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>{selectedSnag.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/20 rounded-lg border border-border text-[10px]">
                  <div>
                    <p className="font-bold text-muted-foreground uppercase">{t('assigned_to_label')}</p>
                    <p className="font-medium">{selectedSnag.assignee?.name || t('unassigned_label')}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted-foreground uppercase">{t('created_by_label')}</p>
                    <p className="font-medium">{selectedSnag.creator?.name || '—'}</p>
                  </div>
                </div>

                {selectedSnag.linked_folders && selectedSnag.linked_folders.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('linked_folders_title')}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSnag.linked_folders.map((f: { id: number; name: string; folder_type: string }) => (
                        <button 
                          key={f.id} 
                          onClick={() => {
                            setSelectedSnag(null);
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

                <div className="pt-4 border-t border-border space-y-3">
                  <style>{`
                    .no-scrollbar::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('response_title')}</p>
                  <div 
                    ref={chatContainerRef} 
                    className="space-y-3 max-h-[320px] overflow-y-auto pr-1 no-scrollbar" 
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {loadingMessages ? (
                      <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('loading')}</div>
                    ) : (conversationMessages.length === 0 && !selectedSnag?.response && (!selectedSnag?.responsePhotoUrls || selectedSnag.responsePhotoUrls.length === 0)) ? (
                      <p className="text-xs text-muted-foreground">No messages yet.</p>
                    ) : (
                      <>
                        {/* Legacy Response Block */}
                        {(selectedSnag?.response || (selectedSnag?.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0)) && (
                          <div className="flex justify-start mb-3">
                            <div className="max-w-[80%] rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                              <p className="text-[10px] font-bold mb-1 text-muted-foreground">
                                Response
                              </p>
                              {selectedSnag.response && (
                                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{selectedSnag.response}</p>
                              )}
                              {selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {selectedSnag.responsePhotoUrls.map((url, idx) => {
                                    const isAudioFile = isAudio(url);
                                    if (isAudioFile) {
                                      return (
                                        <div key={idx} className="w-full max-w-sm mt-1">
                                          <VoiceNotePlayer url={url} isMe={false} />
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <img
                                          key={idx}
                                          src={url}
                                          alt="Response image"
                                          className="max-h-36 rounded-lg border border-black/5 cursor-pointer"
                                          onClick={() => setViewPhoto(url)}
                                        />
                                      );
                                    }
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Chat Messages */}
                        {conversationMessages.map((message) => {
                          const isMine = String(message.sender_id) === String(user?.id);
                          return (
                            <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                              <div className={cn("max-w-[80%] rounded-2xl border px-3 py-2 shadow-sm", isMine ? "bg-accent text-accent-foreground border-accent/40" : "bg-card border-border")}>
                                <p className={cn("text-[10px] font-bold mb-1", isMine ? "text-accent-foreground/80" : "text-muted-foreground")}>
                                  {message.sender?.name || (isMine ? 'You' : 'User')}
                                </p>
                                {message.text && <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>}
                                {message.attachment_type === 'image' && message.downloadUrl && (
                                  <img src={message.downloadUrl} alt={message.file_name || 'Attachment'} className="mt-2 max-h-56 rounded-lg border border-black/5 cursor-pointer" onClick={() => setViewPhoto(message.downloadUrl!)} />
                                )}
                                {message.attachment_type === 'audio' && message.downloadUrl && (
                                  <div className="mt-2">
                                    <VoiceNotePlayer url={message.downloadUrl} isMe={isMine} />
                                  </div>
                                )}
                                <p className={cn("mt-2 text-[10px]", isMine ? "text-accent-foreground/70" : "text-muted-foreground")}>
                                  {new Date(message.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {isConversationParticipant && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Conversation</p>
                    {isConversationClosed ? (
                      <div className="rounded-xl border border-border bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">
                        {t('completed_status')} - messages are disabled.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
                        {messagePreview && (
                          <div className="rounded-2xl border border-border bg-secondary/20 p-3">
                            {messageFile && isAudioFile(messageFile) ? (
                              <VoiceNotePlayer url={messagePreview} isMe={false} />
                            ) : (
                              <div className="flex items-center gap-3">
                                <img src={messagePreview} className="w-20 h-20 rounded-xl object-cover border border-border" />
                                <div className="flex flex-col gap-2">
                                  <p className="text-sm font-semibold">{t('photo')}</p>
                                  <div className="flex items-center gap-2">
                                    <label className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium cursor-pointer hover:bg-secondary/40 transition-colors">
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit
                                      <input type="file" accept="image/*" className="hidden" onChange={handleMessageFileSelect} />
                                    </label>
                                    <button
                                      onClick={() => {
                                        setMessageFile(null);
                                        setMessagePreview(null);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            {messageFile && isAudioFile(messageFile) ? (
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => {
                                    setMessageFile(null);
                                    setMessagePreview(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <Textarea 
                          placeholder={t('add_comment_placeholder')} 
                          className="min-h-[96px] resize-none text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0" 
                          value={messageText}
                          onChange={e => setMessageText(e.target.value)}
                        />
                        <div className="flex items-end gap-3">
                          <div className="flex flex-1 items-center gap-3">
                            {!messageFile && !isVoiceRecording && (
                              <label className="w-11 h-11 rounded-xl border border-border bg-background flex items-center justify-center hover:bg-secondary/30 transition-colors cursor-pointer shrink-0">
                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                <input type="file" accept="image/*,audio/*" className="hidden" onChange={handleMessageFileSelect} />
                              </label>
                            )}
                            {!messageFile && (
                              <div className="flex-1 min-w-0">
                                <VoiceNoteRecorder 
                                  onRecordingStateChange={setIsVoiceRecording}
                                  onSend={(file) => {
                                    setMessageFile(file);
                                    setMessagePreview(URL.createObjectURL(file));
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          {!isVoiceRecording && (
                            <Button 
                              className="min-w-[140px] h-11 rounded-xl bg-accent hover:bg-accent/90" 
                              onClick={handleSendMessage}
                              disabled={submitting || (!messageText.trim() && !messageFile)}
                            >
                              {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <MessageSquare className="h-3 w-3 mr-2" />}
                              Send message
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isConversationParticipant && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('update_status_respond_title')}</p>
                    <div className="flex gap-2">
                      {STATUS_CYCLE.map(s => (
                        <Button 
                          key={s} 
                          size="sm" 
                          variant={selectedSnag.status === s ? 'default' : 'outline'}
                          className={cn("flex-1 text-[10px] h-8", selectedSnag.status === s && STATUS_CONFIG[s].bg && STATUS_CONFIG[s].text)}
                          onClick={() => cycleStatus(selectedSnag, s)}
                        >
                          {t(STATUS_CONFIG[s].key).split(' ')[0]}
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

      {/* Photo Viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-lg p-2">
          {viewPhoto && <img src={viewPhoto} alt="Snag detail" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>

      <FolderPickerDialog 
          open={showFolderPicker}
          onOpenChange={setShowFolderPicker}
          project={project}
          selectedFolderIds={selectedFolderIds}
          submitting={submitting}
          onSelect={async (ids) => {
              setSelectedFolderIds(ids.map(Number));
              if (selectedSnag && !isEditing) {
                  await handleUpdateLinks(ids);
              } else {
                  setShowFolderPicker(false);
              }
          }}
      />
    </div>
  );
};

export default ProjectSnagList;
