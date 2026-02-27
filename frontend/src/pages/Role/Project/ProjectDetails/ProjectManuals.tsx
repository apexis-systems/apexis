"use client";

import { useState } from 'react';
import { Project, ManualSOP } from '@/types';
import { mockManuals } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Upload, Trash2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProjectManualsProps {
  project: Project;
}

const ProjectManuals = ({ project }: ProjectManualsProps) => {
  const { user } = useAuth();

  if (!project) return null;

  const [manuals, setManuals] = useState<ManualSOP[]>(
    mockManuals.filter((m) => m.projectId === project.id)
  );

  const handleUpload = () => {
    toast.info('Upload functionality — connect to backend');
  };

  const deleteManual = (id: string) => {
    setManuals((prev) => prev.filter((m) => m.id !== id));
    toast.success('Manual removed');
  };

  return (
    <div className="mt-3">
      {user?.role === 'admin' && (
        <Button onClick={handleUpload} className="mb-3 w-full h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold">
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Manual / SOP
        </Button>
      )}

      <div className="space-y-1.5">
        {manuals.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg bg-card border border-border p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold truncate text-foreground">{m.name}</p>
              <p className="text-[9px] text-muted-foreground">{m.size} · {m.uploadDate}</p>
            </div>
            {user?.role === 'admin' && (
              <button onClick={() => deleteManual(m.id)} className="rounded-md p-1 hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      {manuals.length === 0 && (
        <div className="mt-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No manuals or SOPs yet</p>
        </div>
      )}
    </div>
  );
};

export default ProjectManuals;
