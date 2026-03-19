"use client";

import { useState, useEffect } from 'react';
import { Project, User, Folder } from '@/types';
import { FileText, Upload, Trash2, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2, Move, X, List, LayoutGrid, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders } from '@/services/folderService';
import { getFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles } from '@/services/fileService';
import MoveToFolderDialog from './MoveToFolderDialog';
import { Checkbox } from '@/components/ui/Checkbox';

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

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');

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

  const sortItems = (items: any[], type: 'folder' | 'file') => {
    return [...items].sort((a: any, b: any) => {
      if (sortBy === 'name') {
        const nameA = type === 'folder' ? a.name : a.file_name;
        const nameB = type === 'folder' ? b.name : b.file_name;
        return (nameA || '').localeCompare(nameB || '');
      }
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'size') {
        if (type === 'folder') return (a.name || '').localeCompare(b.name || '');
        return (b.file_size_mb || 0) - (a.file_size_mb || 0);
      }
      return 0;
    });
  };

  const sortedFolders = sortItems(currentFolders, 'folder');
  const sortedDocs = sortItems(visibleDocs, 'file');

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
    setMovingItem(null); // Explicitly null means bulk
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
    // For now, share first item or concatenated links
    // The requirement says "share that files", implies some share logic
    // We'll just open share dialog for the first file if any file is selected
    if (selectedFiles.size > 0) {
      const firstId = Array.from(selectedFiles)[0];
      const firstDoc = docs.find(d => d.id === firstId);
      if (firstDoc) setShareItem(firstDoc.file_name);
    } else {
      toast.info("Select at least one file to share");
    }
  };

  return (
    <div className="mt-3">
      {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
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

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Sorting */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-semibold gap-1.5 text-muted-foreground bg-secondary/50">
                Sort by: <span className="text-foreground capitalize">{sortBy}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-[10px]">Sort Docs By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('name')} className="text-xs flex items-center justify-between">
                Name {sortBy === 'name' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('date')} className="text-xs flex items-center justify-between">
                Date Modified {sortBy === 'date' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('size')} className="text-xs flex items-center justify-between">
                Size {sortBy === 'size' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {sortedFolders.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder_id === folder.id);
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
                  {folderDocs.length} files{subFolders.length > 0 ? `, ${subFolders.length} folder${subFolders.length === 1 ? '' : 's'}` : ''}
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
        type="documents"
      />

      <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-2" : "space-y-1.5"}>
        {sortedDocs.map((doc) => {
          const isSelected = selectedFiles.has(doc.id);

          if (viewMode === 'grid') {
            return (
              <div
                key={doc.id}
                className={`relative flex flex-col items-center gap-1 p-3 rounded-lg bg-card border transition-colors cursor-pointer group ${isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'}`}
                onClick={() => {
                  if (isSelectionMode) toggleSelection('file', doc.id);
                  else window.open(doc.downloadUrl, '_blank');
                }}
              >
                {isSelectionMode && (
                  <div className="absolute top-2 right-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('file', doc.id)} />
                  </div>
                )}
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${doc.file_type.includes('pdf') ? 'bg-red-50 dark:bg-red-950/30' : 'bg-blue-50 dark:bg-blue-950/30'}`}>
                  <FileText className={`h-6 w-6 ${doc.file_type.includes('pdf') ? 'text-red-500' : 'text-blue-500'}`} />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight line-clamp-2 px-1 mt-1">
                  {doc.file_name}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5">
                  {doc.file_size_mb} MB
                </span>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isSelectionMode && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setShareItem(doc.file_name); }} className="rounded-full bg-card/80 p-1 backdrop-blur-sm shadow-sm border border-border">
                        <Share2 className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                      {user.role === 'admin' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleDocVisibility(doc); }} className="rounded-full bg-card/80 p-1 backdrop-blur-sm shadow-sm border border-border">
                          {doc.client_visible !== false ? <Eye className="h-2.5 w-2.5 text-accent" /> : <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={doc.id}>
              <div
                className={`flex items-center gap-2 rounded-lg bg-card border p-2 cursor-pointer transition-colors ${isSelected ? 'border-accent bg-accent/5' : 'border-border'}`}
                onClick={() => {
                  if (isSelectionMode) toggleSelection('file', doc.id);
                }}
              >
                ...
                {isSelectionMode && (
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection('file', doc.id)} className="mr-1" />
                )}
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${doc.file_type.includes('pdf') ? 'bg-red-50 dark:bg-red-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                  <FileText className={`h-4 w-4 ${doc.file_type.includes('pdf') ? 'text-red-500' : 'text-blue-500'}`} />
                </div>
                <button
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.stopPropagation();
                      toggleSelection('file', doc.id);
                    } else {
                      window.open(doc.downloadUrl, '_blank');
                    }
                  }}
                  className="flex-1 min-w-0 text-left hover:underline"
                >
                  <p className="text-[10px] font-semibold truncate">{doc.file_name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {doc.file_size_mb} MB
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  {!isSelectionMode && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setShareItem(doc.file_name); }} className="rounded-md p-1 hover:bg-secondary">
                        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMovingItem({ type: 'file', id: doc.id }); setShowMoveDialog(true); }}
                        className="rounded-md p-1 hover:bg-secondary"
                        title="Move file"
                      >
                        <Move className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {user.role === 'admin' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleDocVisibility(doc); }} className="rounded-md p-1 hover:bg-secondary" title={`Toggle client visibility (Currently: ${doc.client_visible !== false ? 'Visible' : 'Hidden'})`}>
                          {doc.client_visible !== false ? (
                            <Eye className="h-3.5 w-3.5 text-accent" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (String(doc.created_by) === String(user.id) || String(doc.creator?.id) === String(user.id)) && (
                        <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }} className="rounded-md p-1 hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {expandedDoc === doc.id && (
                <div className="ml-2 mr-2">
                  <CommentThread targetId={doc.id} targetType="document" />
                </div>
              )}
            </div>
          );
        })}
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
              className="ml-2 text-muted-foreground hover:text-foreground p-1"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
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

export default ProjectDocuments;
