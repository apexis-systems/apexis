"use client";

import { useState, useEffect } from 'react';
import { Project, User, Folder } from '@/types';
import { FileText, Upload, Trash2, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();

  if (!project) return null;

  const [docs, setDocs] = useState<any[]>([]);
  // Initialize from URL ?folder= param for back-navigation restoration
  const [selectedFolder, setRawSelectedFolder] = useState<string | null>(
    searchParams?.get('folder') || null
  );
  const [folders, setFolders] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Keep URL in sync with selectedFolder so returnUrl always has correct folder
  const setSelectedFolder = (folderId: string | null) => {
    setRawSelectedFolder(folderId);
    const url = new URL(window.location.href);
    if (folderId) { url.searchParams.set('folder', folderId); }
    else { url.searchParams.delete('folder'); }
    window.history.replaceState(null, '', url.toString());
  };

  useEffect(() => {
    if (project?.id) {
      importFolders();
    }
  }, [project?.id]);

  const importFolders = async () => {
    try {
      const json = await getFiles(project.id);
      if (json.folderData) {
        setFolders(json.folderData);
      }
      if (json.fileData) {
        setDocs(json.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
      }
    } catch (e) {
      console.error("Failed to fetch folders/files", e);
    }
  };

  // Use loose equality (==) to handle number vs string IDs from API
  const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
  const currentFolderDocs = docs.filter((d) => String(d.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
  const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.client_visible) : currentFolderDocs;

  const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

  const goBack = () => {
    if (!selectedFolder) return;
    const parentId = currentFolder?.parent_id != null ? String(currentFolder.parent_id) : null;
    setSelectedFolder(parentId);
  };

  const getBreadcrumbs = () => {
    if (!currentFolder) return [];
    const path: any[] = [];
    let curr: any = currentFolder;
    while (curr) {
      path.unshift(curr);
      curr = folders.find((f) => f.id === curr.parent_id);
    }
    return path;
  };

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
    // URL already has ?tab=documents and ?folder=ID (from setSelectedFolder sync), just encode it
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'documents');
    if (selectedFolder) url.searchParams.set('folder', selectedFolder);
    else url.searchParams.delete('folder');
    const returnUrl = encodeURIComponent(url.pathname + url.search);
    router.push(`/${user.role}/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder || ''}&returnUrl=${returnUrl}`);
  };

  const handleCreateFolder = async (name: string) => {
    try {
      const res = await createFolder({ project_id: project.id, name, parent_id: selectedFolder });
      toast.success(`Folder "${name}" created`);
      await importFolders(); // Refetch
      if (res.folder) {
        setSelectedFolder(String(res.folder.id));
      }
    } catch (e) {
      toast.error("Failed to create folder");
    }
  };

  return (
    <div className="mt-3">
      {user.role !== 'client' && (
        <div className="flex gap-2 mb-3">
          <Button
            onClick={handleUpload}
            className="flex-1 h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload File
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

      <div className="flex items-center mb-3">
        {currentFolder && (
          <button onClick={goBack} className="rounded-full p-1.5 hover:bg-secondary flex-shrink-0 mr-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FolderIcon className="h-4 w-4 text-accent flex-shrink-0" />
          <div className="text-xs font-semibold truncate flex items-center gap-1 hover:text-accent transition-colors">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`truncate ${!selectedFolder ? 'text-accent' : 'hover:underline text-muted-foreground'}`}
            >
              {project?.name}
            </button>
            {getBreadcrumbs().map((b) => (
              <div key={b.id} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={() => setSelectedFolder(b.id)}
                  className={`truncate ${selectedFolder === b.id ? 'text-accent' : 'hover:underline text-muted-foreground'}`}
                >
                  {b.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {currentFolders.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder_id === folder.id);
          const subFolders = folders.filter((f) => f.parent_id === folder.id);
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
                  {folderDocs.length} files{subFolders.length > 0 ? `, ${subFolders.length} folder${subFolders.length === 1 ? '' : 's'}` : ''}
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



      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        onCreateFolder={handleCreateFolder}
        type="documents"
      />

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

      {currentFolders.length === 0 && visibleDocs.length === 0 && (
        <div className="mt-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No folders or documents yet</p>
        </div>
      )}

      {shareItem && (
        <ShareDialog open={!!shareItem} onOpenChange={() => setShareItem(null)} itemName={shareItem} />
      )}
    </div>
  );
};

export default ProjectDocuments;
