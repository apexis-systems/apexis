"use client";

import { useState, useRef } from 'react';
import { Project, SnagItem, SnagStatus } from '@/types';
import { mockSnags, mockAllUsers } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';
import { X, Minus, Check, Plus, MessageSquare, ImagePlus, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProjectSnagListProps {
  project: Project;
  compact?: boolean;
}

const statusConfig: Record<SnagStatus, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  red: { icon: X, bg: 'bg-destructive', text: 'text-destructive-foreground', label: 'No action needed' },
  amber: { icon: Minus, bg: 'bg-amber-500', text: 'text-white', label: 'Waiting clearance' },
  green: { icon: Check, bg: 'bg-green-600', text: 'text-white', label: 'Completed' },
};

const ProjectSnagList = ({ project, compact = false }: ProjectSnagListProps) => {
  const { user } = useAuth();

  if (!project) return null;

  const [snags, setSnags] = useState<SnagItem[]>(
    mockSnags.filter((s) => s.projectId === project.id)
  );
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setNewPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addSnag = () => {
    if (!newTitle.trim() || !newAssignee) {
      toast.error('Title and assignee required');
      return;
    }
    const assignee = mockAllUsers.find((u) => u.id === newAssignee);
    const snag: SnagItem = {
      id: `s-${Date.now()}`,
      projectId: project.id,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      photoUrl: newPhotoPreview || undefined,
      assignedTo: newAssignee,
      assignedToName: assignee?.name || 'Unknown',
      status: 'amber',
      comments: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSnags((prev) => [...prev, snag]);
    setNewTitle('');
    setNewDescription('');
    setNewPhotoPreview(null);
    setNewAssignee('');
    setShowAdd(false);
    toast.success('Snag added');
  };

  const cycleStatus = (id: string) => {
    const order: SnagStatus[] = ['amber', 'green', 'red'];
    setSnags((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const idx = order.indexOf(s.status);
        return { ...s, status: order[(idx + 1) % order.length] };
      })
    );
  };

  return (
    <div className={cn(compact ? '' : 'mt-3')}>
      {!compact && user?.role !== 'client' && (
        <Button onClick={() => setShowAdd(true)} className="mb-3 bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Snag
        </Button>
      )}

      <div className="space-y-2">
        {snags.map((snag) => {
          const cfg = statusConfig[snag.status];
          const Icon = cfg.icon;
          return (
            <div key={snag.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <button onClick={() => cycleStatus(snag.id)} className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5', cfg.bg)}>
                <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{snag.title}</p>
                {snag.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{snag.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Assigned: {snag.assignedToName} · {cfg.label}
                </p>
                {snag.comments.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {snag.comments[snag.comments.length - 1]}
                  </div>
                )}
              </div>
              {snag.photoUrl && (
                <button
                  onClick={() => setViewPhoto(snag.photoUrl!)}
                  className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden border border-border group"
                >
                  <img src={snag.photoUrl} alt="Snag photo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white" />
                  </div>
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
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Snag title" maxLength={200} />
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="min-h-[60px] text-xs"
              maxLength={500}
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {newPhotoPreview ? (
                <div className="relative w-full h-32 rounded-md overflow-hidden border border-border">
                  <img src={newPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setNewPhotoPreview(null)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs h-9"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Attach Photo
                </Button>
              )}
            </div>
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Assign to..." /></SelectTrigger>
              <SelectContent>
                {mockAllUsers.filter((u) => u.role !== 'client').map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addSnag} className="bg-accent text-accent-foreground hover:bg-accent/90">Add</Button>
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
