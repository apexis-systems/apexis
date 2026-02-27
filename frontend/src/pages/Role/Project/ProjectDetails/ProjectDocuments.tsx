"use client";

import { useState } from 'react';
import { Project, User, ProjectDocument, Folder } from '@/types';
import { mockDocuments, mockFolders } from '@/data/mock';
import { FileText, Upload, Trash2, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';

interface ProjectDocumentsProps {
  project: Project;
  user: User;
}

const ProjectDocuments = ({ project, user }: ProjectDocumentsProps) => {
  const router = useRouter();

  if (!project) return null;

  const [docs, setDocs] = useState<ProjectDocument[]>(
    mockDocuments.filter((d) => d.projectId === project.id)
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>(
    mockFolders.filter((f) => f.projectId === project.id && f.type === 'documents')
  );
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const currentFolderDocs = selectedFolder
    ? docs.filter((d) => d.folderId === selectedFolder)
    : [];

  const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.clientVisible) : currentFolderDocs;

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  const toggleVisibility = (docId: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, clientVisible: !d.clientVisible } : d))
    );
    toast.success('Visibility updated');
  };

  const deleteDoc = (docId: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success('Document deleted');
  };

  const handleUpload = () => {
    router.push(`/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder}`);
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: `folder-doc-${Date.now()}`,
      projectId: project.id,
      name,
      type: 'documents',
    };
    setFolders((prev) => [...prev, newFolder]);
    toast.success(`Folder "${name}" created`);
  };

  // Folder View
  if (!selectedFolder) {
    return (
      <div className="mt-3">
        {user.role !== 'client' && (
          <div className="flex gap-2 mb-3">
            <Button
              onClick={() => toast.info('Select a folder first')}
              className="flex-1 h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
            </Button>
            <Button
              onClick={() => setShowCreateFolder(true)}
              variant="outline"
              className="h-9 rounded-lg text-xs font-semibold"
            >
              <FolderPlus className="h-3.5 w-3.5 mr-1.5" /> New Folder
            </Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {folders.map((folder) => {
            const folderDocs = docs.filter((d) => d.folderId === folder.id);
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border border-border hover:border-accent transition-colors"
              >
                <FolderIcon className="h-8 w-8 text-accent" />
                <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                  {folder.name}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {folderDocs.length} files
                </span>
              </button>
            );
          })}
        </div>

        {folders.length === 0 && (
          <div className="mt-6 text-center">
            <FolderIcon className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-1.5 text-xs text-muted-foreground">No folders yet</p>
          </div>
        )}

        <CreateFolderDialog
          open={showCreateFolder}
          onOpenChange={setShowCreateFolder}
          onCreateFolder={handleCreateFolder}
          type="documents"
        />
      </div>
    );
  }

  // Files View (inside folder)
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setSelectedFolder(null)} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <FolderIcon className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold">{currentFolder?.name}</span>
        </div>
      </div>

      {user.role !== 'client' && (
        <Button
          onClick={handleUpload}
          className="mb-3 w-full h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Document
        </Button>
      )}

      <div className="space-y-1.5">
        {visibleDocs.map((doc) => (
          <div key={doc.id}>
            <div className="flex items-center gap-2 rounded-lg bg-card border border-border p-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${doc.type === 'pdf' ? 'bg-red-50 dark:bg-red-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                <FileText className={`h-4 w-4 ${doc.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`} />
              </div>
              <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} className="flex-1 min-w-0 text-left">
                <p className="text-[10px] font-semibold truncate">{doc.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  v{doc.version} · {doc.size}
                </p>
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => setShareItem(doc.name)} className="rounded-md p-1 hover:bg-secondary">
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => toggleVisibility(doc.id)} className="rounded-md p-1 hover:bg-secondary">
                    {doc.clientVisible ? (
                      <Eye className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
                {(user.role === 'admin' || user.role === 'contributor') && doc.uploaderId === user.id && (
                  <button onClick={() => deleteDoc(doc.id)} className="rounded-md p-1 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
            </div>
            {expandedDoc === doc.id && (
              <div className="ml-2 mr-2">
                <CommentThread targetId={doc.id} targetType="document" />
              </div>
            )}
          </div>
        ))}
      </div>

      {visibleDocs.length === 0 && (
        <div className="mt-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No documents yet</p>
        </div>
      )}

      {shareItem && (
        <ShareDialog open={!!shareItem} onOpenChange={() => setShareItem(null)} itemName={shareItem} />
      )}
    </div>
  );
};

export default ProjectDocuments;
