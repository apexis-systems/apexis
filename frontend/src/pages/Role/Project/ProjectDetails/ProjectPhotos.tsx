"use client";

import { useState, useEffect } from 'react';
import { Project, User, Folder } from '@/types';
import { Camera, Upload, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2, Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders } from '@/services/folderService';
import { getFiles, toggleFileVisibility, bulkUpdateFiles } from '@/services/fileService';
import MoveToFolderDialog from './MoveToFolderDialog';
import { Checkbox } from '@/components/ui/Checkbox';

interface ProjectPhotosProps {
  project: Project;
  user: User;
}

const ProjectPhotos = ({ project, user }: ProjectPhotosProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!project) return null;

  const [photos, setPhotos] = useState<any[]>([]);
  // Initialize from URL ?folder= param for back-navigation restoration
  const [selectedFolder, setRawSelectedFolder] = useState<string | null>(
    searchParams?.get('folder') || null
  );
  const [folders, setFolders] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);

  // Sync selectedFolder to URL so returnUrl always encodes correct folder
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
        setPhotos(json.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
      }
    } catch (e) {
      console.error("Failed to fetch folders/files", e);
    }
  };

  const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
  const currentFolderPhotos = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));

  const visiblePhotos = user.role === 'client' ? currentFolderPhotos.filter((p) => p.client_visible) : currentFolderPhotos;

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

  const togglePhotoVisibility = async (photo: any) => {
    try {
      await toggleFileVisibility(photo.id, !photo.client_visible);
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, client_visible: !photo.client_visible } : p));
      toast.success(`Photo marked ${!photo.client_visible ? 'Visible' : 'Hidden'} for clients`);
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

  const handleUpload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'photos');
    if (selectedFolder) url.searchParams.set('folder', selectedFolder);
    else url.searchParams.delete('folder');
    const returnUrl = encodeURIComponent(url.pathname + url.search);
    router.push(`/${user.role}/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder || ''}&returnUrl=${returnUrl}`);
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

  const toggleSelection = (type: 'folder' | 'file', id: string | number) => {
    if (type === 'folder') {
      const newSet = new Set(selectedFolders);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedFolders(newSet);
    } else {
      const newSet = new Set(selectedFiles);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedFiles(newSet);
    }
  };

  const clearSelection = () => {
    setSelectedFolders(new Set());
    setSelectedFiles(new Set());
    setIsSelectionMode(false);
  };

  const hasSelection = selectedFolders.size > 0 || selectedFiles.size > 0;

  const handleBulkMove = () => {
    setMovingItem(null); // Bulk
    setShowMoveDialog(true);
  };

  const handleSingleMove = (type: 'folder' | 'file', id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMovingItem({ type, id });
    setShowMoveDialog(true);
  };

  const handleBulkVisibility = async (visible: boolean) => {
    try {
      const promises = [];
      if (selectedFolders.size > 0) {
        promises.push(bulkUpdateFolders({ ids: Array.from(selectedFolders), client_visible: visible }));
      }
      if (selectedFiles.size > 0) {
        promises.push(bulkUpdateFiles({ ids: Array.from(selectedFiles), client_visible: visible }));
      }
      await Promise.all(promises);
      toast.success(`Visibility updated for ${selectedFolders.size + selectedFiles.size} items`);
      importFolders();
      clearSelection();
    } catch (e) {
      toast.error("Failed to update visibility");
    }
  };

  const handleBulkShare = () => {
    if (selectedFiles.size > 0) {
      const firstId = Array.from(selectedFiles)[0];
      const firstPhoto = photos.find(p => p.id === firstId);
      if (firstPhoto) setShareItem(`Photo - ${firstPhoto.location || firstPhoto.file_name}`);
    } else {
      toast.info("Select at least one photo to share");
    }
  };

  // Unified Layout
  return (
    <div className="mt-3">
      {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
        <div className="flex gap-2 mb-3">
          <Button
            onClick={handleUpload}
            className="flex-1 h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Photo
          </Button>
          <Button
            onClick={() => setShowCreateFolder(true)}
            variant="outline"
            className="h-9 rounded-lg text-xs font-semibold"
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" /> New Folder
          </Button>
          <Button
            onClick={() => {
              if (isSelectionMode) clearSelection();
              else setIsSelectionMode(true);
            }}
            variant={isSelectionMode ? "secondary" : "outline"}
            className="h-9 rounded-lg text-xs font-semibold px-3"
          >
            {isSelectionMode ? 'Cancel' : 'Select'}
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
          const folderPhotos = photos.filter((p) => p.folder_id === folder.id);
          const subFolders = folders.filter((f) => f.parent_id === folder.id);
          const isSelected = selectedFolders.has(folder.id);
          return (
            <button
              key={folder.id}
              onClick={() => {
                if (isSelectionMode) toggleSelection('folder', folder.id);
                else setSelectedFolder(folder.id);
              }}
              className={`relative flex flex-col items-center gap-1 p-3 rounded-lg bg-card border transition-colors ${isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'}`}
            >
              {isSelectionMode && (
                <div className="absolute top-2 right-2 z-10">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('folder', folder.id)} />
                </div>
              )}
              <FolderIcon className="h-8 w-8 text-accent" />
              <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2 mt-1">
                {folder.name}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] text-muted-foreground mr-1">
                  {folderPhotos.length} photos{subFolders.length > 0 ? `, ${subFolders.length} folder${subFolders.length === 1 ? '' : 's'}` : ''}
                </span>
                {(user.role === 'admin' || user.role === 'superadmin') && !isSelectionMode && (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => toggleFolderVis(folder, e)} className="rounded p-1 hover:bg-secondary transition-colors">
                      {folder.client_visible !== false ? <Eye className="h-3 w-3 text-accent" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <button onClick={(e) => handleSingleMove('folder', folder.id, e)} className="rounded p-1 hover:bg-secondary transition-colors" title="Move folder">
                      <Move className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
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
        type="photos"
      />

      <div className="grid grid-cols-5 gap-0.5">
        {visiblePhotos.map((photo) => {
          const isSelected = selectedFiles.has(photo.id);
          return (
            <div
              key={photo.id}
              className={`relative aspect-square bg-secondary cursor-pointer transition-all ${isSelected ? 'ring-2 ring-accent ring-inset overflow-hidden' : ''}`}
              onClick={() => {
                if (isSelectionMode) toggleSelection('file', photo.id);
              }}
            >
              <button
                onClick={(e) => {
                  if (isSelectionMode) {
                    e.stopPropagation();
                    toggleSelection('file', photo.id);
                  } else {
                    window.open(photo.downloadUrl, '_blank');
                  }
                }}
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
              >
                <img src={photo.downloadUrl} alt={photo.file_name} className={`w-full h-full object-cover ${isSelected ? 'opacity-80' : ''}`} />
              </button>

              <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                {isSelectionMode ? (
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('file', photo.id)} className="bg-card/80 backdrop-blur-sm" />
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShareItem(`Photo - ${photo.location || photo.file_name}`); }}
                      className="rounded-full bg-card/80 p-0.5 backdrop-blur-sm"
                    >
                      <Share2 className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMovingItem({ type: 'file', id: photo.id }); setShowMoveDialog(true); }}
                      className="rounded-full bg-card/80 p-0.5 backdrop-blur-sm"
                      title="Move photo"
                    >
                      <Move className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePhotoVisibility(photo); }}
                        className="rounded-full bg-card/80 p-0.5 backdrop-blur-sm"
                        title={`Toggle client visibility (Currently: ${photo.client_visible !== false ? 'Visible' : 'Hidden'})`}
                      >
                        {photo.client_visible !== false ? (
                          <Eye className="h-2.5 w-2.5 text-accent" />
                        ) : (
                          <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded photo comment */}
      {expandedPhoto && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground mb-1">
            {visiblePhotos.find((p) => p.id === expandedPhoto)?.file_name}
          </p>
          <CommentThread targetId={expandedPhoto} targetType="photo" />
        </div>
      )}

      {currentFolders.length === 0 && visiblePhotos.length === 0 && (
        <div className="mt-12 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No folders or photos yet</p>
        </div>
      )}

      {shareItem && (
        <ShareDialog open={!!shareItem} onOpenChange={() => setShareItem(null)} itemName={shareItem} />
      )}

      {/* Bulk Action Bar */}
      {isSelectionMode && hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-card border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-4">
            <div className="text-[10px] font-semibold text-muted-foreground border-r border-border pr-4">
              {selectedFolders.size + selectedFiles.size} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[10px] font-semibold hover:text-accent"
                onClick={handleBulkShare}
              >
                <Share2 className="h-3.5 w-3.5 mr-1" /> Share
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[10px] font-semibold hover:text-accent"
                onClick={handleBulkMove}
              >
                <Move className="h-3.5 w-3.5 mr-1" /> Move
              </Button>
              {user.role === 'admin' && (
                <div className="flex items-center gap-1 border-l border-border pl-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-[10px] font-semibold text-accent"
                    onClick={() => handleBulkVisibility(true)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Show
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-[10px] font-semibold text-muted-foreground"
                    onClick={() => handleBulkVisibility(false)}
                  >
                    <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide
                  </Button>
                </div>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <MoveToFolderDialog
        open={showMoveDialog}
        onOpenChange={(open: boolean) => {
          setShowMoveDialog(open);
          if (!open) setMovingItem(null);
        }}
        project={project}
        item={movingItem}
        selectedItems={{ folders: Array.from(selectedFolders), files: Array.from(selectedFiles) }}
        onMoveComplete={() => {
          importFolders();
          clearSelection();
        }}
      />
    </div>
  );
};

export default ProjectPhotos;
