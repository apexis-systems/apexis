"use client";

import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Upload, Trash2, Share2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Manual, ManualType, getManuals, uploadManual, deleteManual } from '@/services/manualService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/helpers/apiError';

interface Props { project: Project; }

const TYPE_OPTIONS: { label: string; value: ManualType }[] = [
  { label: 'Manual', value: 'manual' },
  { label: 'SOP', value: 'sop' },
];

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt';

const ProjectManuals = ({ project }: Props) => {
  const { user } = useAuth();
  if (!project) return null;

  const [items, setItems] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selType, setSelType] = useState<ManualType>('manual');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'contributor';

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await getManuals(project.id as any);
      setItems(data);
    } catch { toast.error('Failed to load manuals'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [project?.id]);

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('project_id', String(project.id));
      form.append('type', selType);
      form.append('file', file);
      const manual = await uploadManual(form);
      setItems(prev => [manual, ...prev]);
      toast.success('Uploaded successfully');
    } catch (error) { toast.error(getApiErrorMessage(error, 'Upload failed')); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; setShowUpload(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────────

  const handleDelete = async (item: Manual) => {
    if (!confirm(`Remove "${item.file_name}"?`)) return;
    try {
      await deleteManual(item.id);
      setItems(prev => prev.filter(m => m.id !== item.id));
      toast.success('Removed');
    } catch { toast.error('Delete failed'); }
  };

  const fmtSize = (mb: number) => mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleShare = (item: Manual) => {
    if (item.downloadUrl) {
      navigator.clipboard.writeText(item.downloadUrl);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className="mt-3">
      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <Button
            onClick={() => setShowUpload(true)}
            className="flex-1 h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Manual / SOP
          </Button>
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={showUpload} onOpenChange={(open) => {
        if (!open) { setPickedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
        setShowUpload(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Upload Manual / SOP</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Type</p>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelType(opt.value)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${selType === opt.value ? 'bg-accent/10 border-accent text-accent' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${pickedFile ? 'border-accent bg-accent/5' : 'border-border bg-secondary/20 hover:border-accent/50'}`}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPickedFile(file);
              }} />
              <Upload className={`h-8 w-8 mb-2 ${pickedFile ? 'text-accent' : 'text-muted-foreground/50'}`} />
              <p className="text-xs font-medium text-foreground text-center">
                {pickedFile ? pickedFile.name : 'Click to select PDF / Word / Excel'}
              </p>
              {pickedFile && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {fmtSize(pickedFile.size / (1024 * 1024))}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUpload(false)} disabled={uploading}>Cancel</Button>
            <Button
              onClick={() => {
                if (pickedFile) {
                  const e = { target: { files: [pickedFile] } } as any;
                  handleFileChange(e);
                }
              }}
              disabled={uploading || !pickedFile}
              className="bg-accent text-accent-foreground hover:bg-accent/90 min-w-[80px]"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-1.5">
          {items.map(m => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-card border border-border p-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                <BookOpen className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => m.downloadUrl && window.open(m.downloadUrl, '_blank')}>
                <p className="text-[10px] font-semibold truncate text-foreground">{m.file_name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {m.type.toUpperCase()} · {fmtSize(m.file_size_mb)} · {fmtDate(m.createdAt)}
                  {m.uploader ? ` · ${m.uploader.name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => handleShare(m)} className="rounded-md p-1 hover:bg-secondary" title="Copy link">
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {isAdmin && String(m.uploaded_by) === String(user?.id) && (
                  <button onClick={() => handleDelete(m)} className="rounded-md p-1 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No manuals or SOPs yet</p>
        </div>
      )}
    </div>
  );
};

export default ProjectManuals;
