"use client";

import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { X, Minus, Check, Plus, MessageSquare, ImagePlus, ZoomIn, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Snag, SnagStatus, Assignee,
  getSnags, createSnag, updateSnagStatus, deleteSnag, getAssignees,
} from '@/services/snagService';

interface ProjectSnagListProps {
  project: Project;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SnagStatus, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  red: { icon: X, bg: 'bg-destructive', text: 'text-destructive-foreground', label: 'No action needed' },
  amber: { icon: Minus, bg: 'bg-amber-500', text: 'text-white', label: 'Waiting clearance' },
  green: { icon: Check, bg: 'bg-green-600', text: 'text-white', label: 'Completed' },
};
const STATUS_CYCLE: SnagStatus[] = ['amber', 'green', 'red'];

const ProjectSnagList = ({ project, compact = false }: ProjectSnagListProps) => {
  const { user } = useAuth();
  if (!project) return null;

  const [snags, setSnags] = useState<Snag[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Status cycle ────────────────────────────────────────────────────────────

  const cycleStatus = async (snag: Snag) => {
    const idx = STATUS_CYCLE.indexOf(snag.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setSnags(prev => prev.map(s => s.id === snag.id ? { ...s, status: next } : s));
    try { await updateSnagStatus(snag.id, next); }
    catch { setSnags(prev => prev.map(s => s.id === snag.id ? { ...s, status: snag.status } : s)); }
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
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('project_id', String(project.id));
      form.append('title', newTitle.trim());
      if (newDescription.trim()) form.append('description', newDescription.trim());
      if (newAssignee) form.append('assigned_to', newAssignee);
      if (newPhoto) form.append('photo', newPhoto);

      const snag = await createSnag(form);
      setSnags(prev => [snag, ...prev]);
      setNewTitle(''); setNewDescription(''); setNewAssignee('');
      setNewPhoto(null); setPhotoPreview(null);
      setShowAdd(false);
      toast.success('Snag added');
    } catch {
      toast.error('Failed to add snag');
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

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className={cn(compact ? '' : 'mt-3')}>
      {!compact && user?.role !== 'client' && (
        <Button onClick={() => setShowAdd(true)} className="mb-3 bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Snag
        </Button>
      )}

      <div className="space-y-2">
        {snags.map((snag) => {
          const cfg = STATUS_CONFIG[snag.status];
          const Icon = cfg.icon;
          const photoUrl = snag.downloadUrl || snag.photo_url;
          return (
            <div key={snag.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              {/* Status circle */}
              <button
                onClick={() => cycleStatus(snag)}
                className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5 transition-all', cfg.bg)}
                title={`Status: ${cfg.label} — click to change`}
              >
                <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{snag.title}</p>
                {snag.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{snag.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Assigned: {snag.assignee?.name || '—'} · {cfg.label}
                </p>
                {snag.last_comment && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {snag.last_comment}
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

              {/* Delete */}
              {(user?.role === 'admin' || user?.role === 'contributor') && (
                <button onClick={() => handleDelete(snag)} className="rounded-md p-1 hover:bg-destructive/10 shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {snags.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">No snags yet</p>
        </div>
      )}

      {/* Add Snag Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Snag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Snag title *" maxLength={200} />
            <Textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="min-h-[60px] text-xs"
              maxLength={500}
            />

            {/* Photo picker */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-md overflow-hidden border border-border">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => { setNewPhoto(null); setPhotoPreview(null); }} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full text-xs h-9" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Attach Photo
              </Button>
            )}

            {/* Assignee select */}
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Assign to... (optional)" /></SelectTrigger>
              <SelectContent>
                {assignees.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={addSnag} disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
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
