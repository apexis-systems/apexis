"use client";

import { useState, useEffect } from 'react';
import { Project, User, Folder } from '@/types';
import { Camera, Upload, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2, Trash2, Move, X, List, Grid, LayoutGrid, ChevronDown, Pencil, ShieldAlert, AlertCircle, AlertTriangle, CheckCircle2, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';


import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles, toggleDoNotFollow, archiveFile, unarchiveFile } from '@/services/fileService';

import MoveToFolderDialog from './MoveToFolderDialog';
import EditFolderDialog from './EditFolderDialog';
import LinkedRFITab from './LinkedRFITab';
import { getFolderRFIs } from '@/services/rfiService';

import { Checkbox } from '@/components/ui/Checkbox';
import FileViewer from '@/components/shared/FileViewer';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProjectPhotosProps {
  project: Project;
  user: User;
}

const ProjectPhotos = ({ project, user }: ProjectPhotosProps) => {
  const router = useRouter();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [photos, setPhotos] = useState<any[]>([]);
  const [selectedFolder, setRawSelectedFolder] = useState<string | null>(
    searchParams?.get('folder') || searchParams?.get('folderId') || null
  );
  const [folders, setFolders] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<any | null>(null);
  const [viewerState, setViewerState] = useState<{ open: boolean, index: number }>({ open: false, index: 0 });
  const [initialFileId, setInitialFileId] = useState<string | null>(searchParams?.get('fileId') || searchParams?.get('photoId') || null);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);
  const [editFolder, setEditFolder] = useState<any | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<any | null>(null);
  const [showDeleteConflict, setShowDeleteConflict] = useState(false);
  const [movingContentsOf, setMovingContentsOf] = useState<any | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [activeFolderTab, setActiveFolderTab] = useState<'files' | 'rfi'>('files');
  const [linkedRFICount, setLinkedRFICount] = useState(0);

  if (!project) return null;

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

  useEffect(() => {
    if (initialFileId && photos.length > 0) {
      // Replicate the filtering logic here to avoid temporal dead zone from sortedPhotos
      const currentFolderPhotosForInit = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
      const visiblePhotosInit = user?.role === 'client' ? currentFolderPhotosForInit.filter((p: any) => p.client_visible) : currentFolderPhotosForInit;
      const sortedInit = [...visiblePhotosInit].sort((a: any, b: any) => {
        if (sortBy === 'name') return (a.file_name || '').localeCompare(b.file_name || '');
        if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'size') return (b.file_size_mb || 0) - (a.file_size_mb || 0);
        return 0;
      });

      const idx = sortedInit.findIndex((p: any) => String(p.id) === String(initialFileId));
      if (idx !== -1) {
        setViewerState({ open: true, index: idx });
        setInitialFileId(null);
        // Clear param to prevent loop
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('fileId');
          url.searchParams.delete('photoId');
          window.history.replaceState(null, '', url.toString());
        }
      }
    }
  }, [initialFileId, photos, selectedFolder, sortBy, user?.role]);

  useEffect(() => {
    if (selectedFolder) {
      setSortBy('date');
      setLinkedRFICount(0); // Reset immediately
    } else {
      setSortBy('name');
      setActiveFolderTab('files');
      setLinkedRFICount(0);
    }
  }, [selectedFolder]);

  // Sync state from URL for tab switching / back navigation
  useEffect(() => {
    const folderId = searchParams?.get('folder') || searchParams?.get('folderId') || null;
    if (folderId !== selectedFolder) {
      setRawSelectedFolder(folderId);
    }
  }, [searchParams]);

  const importFolders = async () => {
    try {
      const json = await getFiles(project.id, 'photo');
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

  useEffect(() => {
    if (selectedFolder) {
      importRFIsForFolder();
    } else {
      setLinkedRFICount(0);
      setActiveFolderTab('files');
    }
  }, [selectedFolder]);

  const importRFIsForFolder = async () => {
    if (!selectedFolder) return;
    try {
      const res = await getFolderRFIs(selectedFolder);
      setLinkedRFICount(res.length);
      if (res.length === 0) setActiveFolderTab('files');
    } catch (error) {
      console.error("Failed to fetch linked RFIs count:", error);
    }
  };

  const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
  const currentFolderPhotos = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));

  const visiblePhotos = user.role === 'client' ? currentFolderPhotos.filter((p: any) => p.client_visible) : currentFolderPhotos;

  const sortItems = (items: any[], type: 'folder' | 'file') => {
    return [...items].sort((a: any, b: any) => {
      if (sortBy === 'name') {
        const nameA = type === 'folder' ? a.name : a.file_name;
        const nameB = type === 'folder' ? b.name : b.file_name;
        return (nameA || '').localeCompare(nameB || '');
      }
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'size') {
        if (type === 'folder') return (a.name || '').localeCompare(b.name || '');
        return (b.file_size_mb || 0) - (a.file_size_mb || 0);
      }
      return 0;
    });
  };

  const sortedFolders = sortItems(currentFolders, 'folder');
  const sortedPhotos = sortItems(visiblePhotos, 'file');

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
      toast.success(photo.client_visible ? t('photo_marked_hidden') : t('photo_marked_visible'));
    } catch (e) {
      toast.error(t('failed_toggle_visibility'));
    }
  };

  const togglePhotoDoNotFollow = async (photo: any) => {
    try {
      await toggleDoNotFollow(photo.id, !photo.do_not_follow);
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, do_not_follow: !photo.do_not_follow } : p));
      toast.success(photo.do_not_follow ? t('photo_unmarked_dnf') : t('photo_marked_dnf'));
    } catch (e) {
      toast.error(t('failed_toggle_dnf'));
    }
  };


  const toggleFolderVis = async (folder: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFolderVisibility(folder.id, !folder.client_visible);
      setFolders((prev) => prev.map((f) => f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f));
      toast.success(folder.client_visible ? t('folder_marked_hidden') : t('folder_marked_visible'));
    } catch (err) {
      toast.error(t('failed_toggle_visibility'));
    }
  };

  const deletePhoto = async (photoId: number) => {
    if (!confirm(t('confirm_delete_photo'))) return;
    try {
      await deleteFile(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success(t('photo_deleted_msg'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('failed_delete_photo'));
    }
  };

  const handleArchivePhoto = async (photoId: number) => {
    try {
      await archiveFile(photoId);
      toast.success(t('photo_archived_success'));
      importFolders();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('failed_to_archive_photo'));
    }
  };

  const handleUnarchivePhoto = async (photoId: number) => {
    try {
      await unarchiveFile(photoId, null);
      toast.success(t('photo_unarchived_success') || 'Photo unarchived successfully');
      await importFolders();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('failed_to_unarchive_photo') || 'Failed to unarchive photo');
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
    const lname = name.toLowerCase();
    if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
      toast.error(t("archive_name_reserved") || "The name 'Archive' or 'Confirmations' is reserved for system use");
      return;
    }
    try {
      const res = await createFolder({ project_id: project.id, name, parent_id: selectedFolder, folder_type: 'photo' });
      toast.success(t('folder_created_msg').replace('{name}', name));
      await importFolders(); // Refetch
      if (res.folder) {
        setSelectedFolder(String(res.folder.id));
      }
    } catch (e) {
      toast.error(t('failed_create_folder'));
    }
  };

  const handleRenameFolder = async (newName: string) => {
    if (!editFolder) return;
    const lname = newName.toLowerCase();
    if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
      toast.error(t("archive_name_reserved") || "The name 'Archive' or 'Confirmations' is reserved for system use");
      return;
    }
    try {
      await updateFolder(editFolder.id, { name: newName });
      toast.success(t('folder_renamed_msg').replace('{name}', newName));
      await importFolders(); // Refetch
    } catch (e) {
      toast.error(t('failed_rename_folder'));
    }
  };

  const handleDeleteFolder = async (folder: any, e: React.MouseEvent, force: boolean = false) => {
    e?.stopPropagation();
    if (!force) {
      if (!confirm(t('confirm_delete_folder').replace('{name}', folder.name))) return;
    }

    try {
      await deleteFolder(folder.id, force);
      toast.success(t('folder_deleted_msg').replace('{name}', folder.name));
      setShowDeleteConflict(false);
      await importFolders(); // Refetch
    } catch (e: any) {
      const data = e.response?.data;
      if (data?.hasContent) {
        setFolderToDelete(folder);
        setShowDeleteConflict(true);
      } else {
        const msg = data?.error || t('failed_delete_folder');
        toast.error(msg);
      }
    }
  };

  const handleRecursiveDelete = async () => {
    if (!folderToDelete) return;
    handleDeleteFolder(folderToDelete, null as any, true);
  };

  const handleMoveContents = () => {
    if (!folderToDelete) return;
    
    // Find direct children
    const childFolders = folders.filter(f => String(f.parent_id) === String(folderToDelete.id));
    const childFiles = photos.filter(p => String(p.folder_id) === String(folderToDelete.id));
    
    if (childFolders.length === 0 && childFiles.length === 0) {
      toast.info(t('folder_already_empty'));
      setShowDeleteConflict(false);
      return;
    }

    setMovingContentsOf(folderToDelete);
    setShowDeleteConflict(false);
    setShowMoveDialog(true);
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
      toast.success(t('visibility_updated_msg').replace('{count}', String(selectedFolders.size + selectedFiles.size)));
      importFolders();
      clearSelection();
    } catch (e) {
      toast.error(t('failed_toggle_visibility'));
    }
  };

  const handleBulkShare = () => {
    if (selectedFiles.size > 0) {
      const firstId = Array.from(selectedFiles)[0];
      const firstPhoto = photos.find(p => p.id === firstId);
      if (firstPhoto) setShareItem(firstPhoto);
    } else {
      toast.info(t('select_photo_share'));
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
            <Upload className="h-3.5 w-3.5 mr-1.5" /> {t('upload_photo_btn')}
          </Button>
          <Button
            onClick={() => setShowCreateFolder(true)}
            variant="outline"
            className="h-9 rounded-lg text-xs font-semibold"
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" /> {t('new_folder_btn')}
          </Button>
          <Button
            onClick={() => {
              if (isSelectionMode) clearSelection();
              else setIsSelectionMode(true);
            }}
            variant={isSelectionMode ? "secondary" : "outline"}
            className="h-9 rounded-lg text-xs font-semibold px-3"
          >
            {isSelectionMode ? t('cancel') : t('select_btn')}
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

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title={t('grid_view_tip')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title={t('list_view_tip')}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Sorting */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-semibold gap-1.5 text-muted-foreground bg-secondary/50">
                {t('sort_by_label')} <span className="text-foreground capitalize">{t(sortBy + '_label')}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-[10px]">{t('sort_photos_title')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('name')} className="text-xs flex items-center justify-between">
                {t('name_label')} {sortBy === 'name' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('date')} className="text-xs flex items-center justify-between">
                {t('date_label')} {sortBy === 'date' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('size')} className="text-xs flex items-center justify-between">
                {t('size_label')} {sortBy === 'size' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedFolder && linkedRFICount > 0 && (
        <div className="flex border-b border-border mb-3">
          <button
            onClick={() => setActiveFolderTab('files')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all relative",
              activeFolderTab === 'files' ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t('photos_folders_tab')}
            {activeFolderTab === 'files' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
          <button
            onClick={() => setActiveFolderTab('rfi')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all relative",
              activeFolderTab === 'rfi' ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t('linked_rfi_tab')}
            {activeFolderTab === 'rfi' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
        </div>
      )}

      {activeFolderTab === 'rfi' && selectedFolder && linkedRFICount > 0 ? (
        <LinkedRFITab folderId={selectedFolder} projectId={project.id} />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
        {sortedFolders.map((folder) => {
          const folderPhotos = photos.filter((p) => p.folder_id === folder.id);
          const subFolders = folders.filter((f) => f.parent_id === folder.id);
          const isSelected = selectedFolders.has(folder.id);
          const isConfirmationFolder = folder.name.toLowerCase() === 'confirmation' || folder.name.toLowerCase() === 'confirmations';
          const isArchiveFolder = folder.name.toLowerCase() === 'archive';
          return (
            <button
              key={folder.id}
              onClick={() => {
                if (isSelectionMode) toggleSelection('folder', folder.id);
                else setSelectedFolder(folder.id);
              }}
              className={`relative flex flex-col items-center gap-1 p-3 rounded-lg bg-card border transition-all group ${isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'}`}
            >
              {!isSelectionMode && !isConfirmationFolder && !isArchiveFolder && (
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-card/80 backdrop-blur-sm p-0.5 rounded-full border border-border shadow-sm">
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <button onClick={(e) => toggleFolderVis(folder, e)} className="rounded-full p-1 hover:bg-secondary transition-colors">
                      {folder.client_visible !== false ? <Eye className="h-2.5 w-2.5 text-accent" /> : <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />}
                    </button>
                  )}
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <button onClick={(e) => handleSingleMove('folder', folder.id, e)} className="rounded-full p-1 hover:bg-secondary transition-colors" title={t('move_folder_tip')}>
                      <Move className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  )}
                  {(['admin', 'superadmin', 'contributor'].includes(user.role)) && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditFolder(folder); }} 
                        className="rounded-full p-1 hover:bg-secondary transition-colors" 
                        title={t('rename_folder_tip')}
                      >
                        <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteFolder(folder, e)} 
                        className="rounded-full p-1 hover:bg-destructive/10 transition-colors" 
                        title={t('delete_folder_tip')}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {isSelectionMode && (
                <div className="absolute top-2 right-2 z-10">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('folder', folder.id)} />
                </div>
              )}
              {isArchiveFolder ? (
                <Archive className="h-8 w-8 text-slate-400" />
              ) : isConfirmationFolder ? (
                <CheckCircle2 className="h-8 w-8 text-orange-400" />
              ) : (
                <FolderIcon className="h-8 w-8 text-accent" />
              )}
              <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 mt-1 ${isArchiveFolder ? 'text-slate-600' : isConfirmationFolder ? 'text-orange-600' : 'text-foreground'}`}>
                {isConfirmationFolder ? "Confirmations" : folder.name}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] text-muted-foreground mr-1">
                  {t('photos_count_label').replace('{count}', String(folderPhotos.length))}{subFolders.length > 0 ? `, ${t('folders_count_label').replace('{count}', String(subFolders.length))}` : ''}
                </span>
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

      <EditFolderDialog
        open={!!editFolder}
        onOpenChange={(open) => !open && setEditFolder(null)}
        onRename={handleRenameFolder}
        currentName={editFolder?.name || ''}
      />


      <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-0.5" : "space-y-1"}>
        {sortedPhotos.map((photo) => {
          const isSelected = selectedFiles.has(photo.id);

          if (viewMode === 'list') {
            return (
              <div
                key={photo.id}
                className={`flex items-center gap-3 rounded-lg border p-2 cursor-pointer transition-colors ${isSelected ? 'border-accent bg-accent/5' : 'border-border bg-card'}`}
                onClick={() => {
                  if (isSelectionMode) toggleSelection('file', photo.id);
                }}
              >
                {isSelectionMode && (
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('file', photo.id)} className="mr-1" />
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary overflow-hidden">
                  <img src={photo.downloadUrl} alt={photo.file_name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div
                    className="min-w-0 text-left cursor-pointer hover:underline"
                    onClick={(e) => {
                      if (!isSelectionMode) {
                        e.stopPropagation();
                        setViewerState({ open: true, index: sortedPhotos.indexOf(photo) });
                      }
                    }}
                  >
                    <p className="text-[10px] font-semibold truncate">{photo.file_name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {formatFileSize(photo.file_size_mb)} • {new Date(photo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {photo.do_not_follow && (
                    <div className="flex-shrink-0 flex items-center gap-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm shadow-sm uppercase tracking-tighter border border-white/20">
                      <ShieldAlert className="h-2.5 w-2.5" /> {t('do_not_follow_tag')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isSelectionMode && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setShareItem(photo); }} className="rounded-md p-1 hover:bg-secondary">
                        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {(user.role === 'admin' || user.role === 'superadmin') && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); togglePhotoVisibility(photo); }} className="rounded-md p-1 hover:bg-secondary" title={t('toggle_client_vis_tip')}>
                            {photo.client_visible !== false ? <Eye className="h-3.5 w-3.5 text-accent" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); togglePhotoDoNotFollow(photo); }} className="rounded-md p-1 hover:bg-secondary" title={t('toggle_dnf_tip')}>
                            <ShieldAlert className={`h-3.5 w-3.5 ${photo.do_not_follow ? 'text-red-500' : 'text-muted-foreground'}`} />
                          </button>
                        </>
                      )}

                      {(user.role === 'admin' || user.role === 'superadmin' || String(photo.created_by) === String(user.id)) && (
                        <>
                          {currentFolder?.name.toLowerCase().includes('archive') ? (
                            <button onClick={(e) => { e.stopPropagation(); handleUnarchivePhoto(photo.id); }} className="rounded-md p-1 hover:bg-blue-500/10" title={t('unarchive_photo_tip') || 'Unarchive photo'}>
                              <Archive className="h-3.5 w-3.5 text-blue-500" />
                            </button>
                          ) : currentFolder?.name.toLowerCase().includes('confirmation') ? (
                            <button onClick={(e) => { e.stopPropagation(); handleArchivePhoto(photo.id); }} className="rounded-md p-1 hover:bg-amber-500/10" title={t('archive_photo_tip')}>
                              <Archive className="h-3.5 w-3.5 text-amber-600" />
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }} className="rounded-md p-1 hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                {photo.do_not_follow && (
                  <div className="flex items-center gap-1 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-sm ml-1 shadow-sm uppercase tracking-tighter border border-white/20">
                    {t('dnf_tag')}
                  </div>
                )}

              </div>

            );
          }

          return (
            <div
              key={photo.id}
              className={`relative aspect-square bg-secondary cursor-pointer transition-all group ${isSelected ? 'ring-2 ring-accent ring-inset overflow-hidden' : ''}`}
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
                    setViewerState({ open: true, index: sortedPhotos.indexOf(photo) });
                  }
                }}
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
              >
                <img src={photo.downloadUrl} alt={photo.file_name} className={`w-full h-full object-cover ${isSelected ? 'opacity-80' : ''}`} />
              </button>

              {isSelectionMode && (
                <div className="absolute top-2 right-2 z-10">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('file', photo.id)} />
                </div>
              )}

              {!isSelectionMode && (
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-card/80 backdrop-blur-sm p-0.5 rounded-full border border-border shadow-sm">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareItem(photo); }}
                    className="rounded-full p-1 hover:bg-secondary transition-colors"
                  >
                    <Share2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePhotoVisibility(photo); }}
                      className="rounded-full p-1 hover:bg-secondary transition-colors"
                      title={t('toggle_client_vis_tip')}
                    >
                      {photo.client_visible !== false ? (
                        <Eye className="h-2.5 w-2.5 text-accent" />
                      ) : (
                        <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  {(user.role === 'admin' || user.role === 'superadmin' || String(photo.created_by) === String(user.id)) && (
                    <>
                      {currentFolder?.name.toLowerCase().includes('archive') ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnarchivePhoto(photo.id); }}
                          className="rounded-full p-1 hover:bg-blue-500/10 transition-colors"
                          title={t('unarchive_photo_tip') || 'Unarchive photo'}
                        >
                          <Archive className="h-2.5 w-2.5 text-blue-500" />
                        </button>
                      ) : currentFolder?.name.toLowerCase().includes('confirmation') ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchivePhoto(photo.id); }}
                          className="rounded-full p-1 hover:bg-amber-500/10 transition-colors"
                          title={t('archive_photo_tip')}
                        >
                          <Archive className="h-2.5 w-2.5 text-amber-600" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                          className="rounded-full p-1 hover:bg-destructive/10 transition-colors"
                          title={t('delete_photo_tip')}
                        >
                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {photo.do_not_follow && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-sm shadow-sm z-20 rotate-[-12deg] border border-white/20 uppercase tracking-tighter">
                  {t('dnf_tag')}
                </div>
              )}

            </div>

          );
        })}
      </div>

      <FileViewer
        files={sortedPhotos}
        initialIndex={viewerState.index}
        open={viewerState.open}
        onOpenChange={(open) => setViewerState(prev => ({ ...prev, open }))}
        user={user}
        onUpdate={(updatedFile) => setPhotos(prev => prev.map(p => p.id === updatedFile.id ? updatedFile : p))}
        targetType="photo"
        projectId={project.id}
      />

      {
        currentFolders.length === 0 && visiblePhotos.length === 0 && (
          <div className="mt-12 text-center">
            <Camera className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-1.5 text-xs text-muted-foreground">{t('no_photos_yet')}</p>
          </div>
        )
      }
        </>
      )}

      {
        shareItem && (
          <ShareDialog
            open={!!shareItem}
            onOpenChange={() => setShareItem(null)}
            itemName={shareItem?.file_name || ''}
            downloadUrl={shareItem?.downloadUrl}
            fileType={shareItem?.file_type}
          />
        )
      }

      {/* Bulk Action Bar */}
      {
        isSelectionMode && hasSelection && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
            <div className="bg-card border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-4">
              <div className="text-[10px] font-semibold text-muted-foreground border-r border-border pr-4">
                {t('items_selected').replace('{count}', String(selectedFolders.size + selectedFiles.size))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-[10px] font-semibold hover:text-accent"
                  onClick={handleBulkShare}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1" /> {t('share_btn')}
                </Button>
                {!currentFolder?.name.toLowerCase().includes('confirmation') && !currentFolder?.name.toLowerCase().includes('archive') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-[10px] font-semibold hover:text-accent"
                    onClick={handleBulkMove}
                  >
                    <Move className="h-3.5 w-3.5 mr-1" /> {t('move_btn')}
                  </Button>
                )}
                {(user.role === 'admin' || user.role === 'superadmin') && (
                  <div className="flex items-center gap-1 border-l border-border pl-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-[10px] font-semibold text-accent"
                      onClick={() => handleBulkVisibility(true)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> {t('show_btn')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-[10px] font-semibold text-muted-foreground"
                      onClick={() => handleBulkVisibility(false)}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" /> {t('hide_btn')}
                    </Button>
                  </div>
                )}
              </div>
              <button
                onClick={clearSelection}
                className="ml-2 text-muted-foreground hover:text-foreground p-1"
                title={t('clear_selection_tip')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      }

      <MoveToFolderDialog
        open={showMoveDialog}
        onOpenChange={(open: boolean) => {
          setShowMoveDialog(open);
          if (!open) {
            setMovingItem(null);
            setMovingContentsOf(null);
          }
        }}
        project={project}
        item={movingItem}
        selectedItems={movingContentsOf ? {
          folders: folders.filter(f => String(f.parent_id) === String(movingContentsOf.id)).map(f => f.id),
          files: photos.filter(p => String(p.folder_id) === String(movingContentsOf.id)).map(p => p.id)
        } : { folders: Array.from(selectedFolders), files: Array.from(selectedFiles) }}
        onMoveComplete={async () => {
          if (movingContentsOf) {
            // After moving contents, delete the original folder
            try {
              await deleteFolder(movingContentsOf.id, false);
              toast.success(t('folder_deleted_move_msg').replace('{name}', movingContentsOf.name));
            } catch (err) {
              toast.error(t('failed_delete_empty_folder'));
            }
          }
          importFolders();
          clearSelection();
          setMovingContentsOf(null);
        }}
        type="photo"
      />

      <Dialog open={showDeleteConflict} onOpenChange={setShowDeleteConflict}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-destructive mb-2">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle>{t('folder_not_empty_title')}</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {t('folder_not_empty_desc').replace('{name}', folderToDelete?.name || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 border-destructive/20 hover:bg-destructive/5 hover:text-destructive text-xs"
              onClick={handleRecursiveDelete}
            >
              <Trash2 className="h-4 w-4 mr-3" />
              <div className="text-left">
                <p className="font-semibold">{t('delete_everything_btn')}</p>
                <p className="text-[10px] opacity-70">{t('delete_everything_desc')}</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 text-xs"
              onClick={handleMoveContents}
            >
              <Move className="h-4 w-4 mr-3" />
              <div className="text-left">
                <p className="font-semibold">{t('move_contents_first_btn')}</p>
                <p className="text-[10px] opacity-70">{t('move_contents_first_desc')}</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-xs" onClick={() => setShowDeleteConflict(false)}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default ProjectPhotos;
