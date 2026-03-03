"use client";

import { useState, useEffect } from 'react';
import { Project, User, Folder } from '@/types';
import { FileText, Upload, Trash2, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';
import { getFolders, createFolder, toggleFolderVisibility } from '@/services/folderService';
import { getFiles, deleteFile, toggleFileVisibility } from '@/services/fileService';

interface ProjectDocumentsProps {
  project: Project;
  user: User;
}

const ProjectDocuments = ({ project, user }: ProjectDocumentsProps) => {
  const router = useRouter();

  if (!project) return null;

  const [docs, setDocs] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  useEffect(() => {
    if (project?.id) {
      importFolders();
    }
  }, [project?.id]);

  const importFolders = async () => {
    try {
      // getFiles on the backend includes the folder hierarchy with attached files natively.
      const json = await getFiles(project.id);
      if (json.folderData) {
        setFolders(json.folderData);

        // Flatten files specifically for document type for root view, or just map them live.
        let fetchedDocs: any[] = [];
        json.folderData.forEach((f: any) => {
          if (f.files) {
            fetchedDocs = [...fetchedDocs, ...f.files.filter((file: any) => !file.file_type?.startsWith('image/'))];

          }
        });
        setDocs(fetchedDocs);
      }
    } catch (e) {
      console.error("Failed to fetch folders", e);
    }
  };

  const currentFolderDocs = selectedFolder
    ? docs.filter((d) => d.folder_id === selectedFolder)
    : [];

  const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.client_visible) : currentFolderDocs;

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  const toggleDocVisibility = async (doc: any) => {
    try {
      await toggleFileVisibility(doc.id, !doc.client_visible);
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, client_visible: !doc.client_visible } : d));
      toast.success(`Document marked ${!doc.client_visible ? 'Visible' : 'Hidden'} for clients`);
    } catch (e) {
      toast.error('Failed to toggle visibility');
    }
  };

  const toggleFolderVis = async (folder: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFolderVisibility(folder.id, !folder.client_visible);
      setFolders((prev) => prev.map((f) => f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f));
      toast.success(`Folder marked ${!folder.client_visible ? 'Visible' : 'Hidden'} for clients`);
    } catch (err) {
      toast.error('Failed to toggle visibility');
    }
  };

  const deleteDoc = async (docId: number) => {
    try {
      await deleteFile(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleUpload = () => {
    router.push(`/${user.role}/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder}`);
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder({ project_id: project.id, name });
      toast.success(`Folder "${name}" created`);
      importFolders(); // Refetch
    } catch (e) {
      toast.error("Failed to create folder");
    }
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
            const folderDocs = docs.filter((d) => d.folder_id === folder.id);
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border border-border hover:border-accent transition-colors"
              >
                <FolderIcon className="h-8 w-8 text-accent" />
                <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2 mt-1">
                  {folder.name}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-muted-foreground mr-1">
                    {folderDocs.length} files
                  </span>
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <button onClick={(e) => toggleFolderVis(folder, e)} className="rounded p-1 hover:bg-secondary transition-colors" title={`Toggle client visibility (Currently: ${folder.client_visible !== false ? 'Visible' : 'Hidden'})`}>
                      {folder.client_visible !== false ? (
                        <Eye className="h-3 w-3 text-accent" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
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
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${doc.file_type.includes('pdf') ? 'bg-red-50 dark:bg-red-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                <FileText className={`h-4 w-4 ${doc.file_type.includes('pdf') ? 'text-red-500' : 'text-blue-500'}`} />
              </div>
              <button onClick={() => window.open(doc.downloadUrl, '_blank')} className="flex-1 min-w-0 text-left cursor-pointer hover:underline">
                <p className="text-[10px] font-semibold truncate">{doc.file_name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {doc.file_size_mb} MB
                </p>
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => setShareItem(doc.name)} className="rounded-md p-1 hover:bg-secondary">
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => toggleDocVisibility(doc)} className="rounded-md p-1 hover:bg-secondary" title={`Toggle client visibility (Currently: ${doc.client_visible !== false ? 'Visible' : 'Hidden'})`}>
                    {doc.client_visible !== false ? (
                      <Eye className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
                {(user.role === 'admin' || user.role === 'superadmin') && (
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
