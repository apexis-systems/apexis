"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tag as TagIcon, Plus, X, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, MapPin, Calendar, User as UserIcon, Maximize2, Minimize2, ZoomIn, ZoomOut, ShieldAlert, HelpCircle, AlertTriangle, RotateCw, Link as LinkIcon, Trash2, MoreVertical, Pencil, Share2, Info, Loader2 } from 'lucide-react';
import CommentThread from './CommentThread';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import { updateFile, downloadFile, markFileSeen, linkFiles, getLinkedItems, deleteLink, toggleDoNotFollow, toggleOnlyForReference, getFileVersions, promoteFile, deleteFile } from '@/services/fileService';
import LinkFileModal from './LinkFileModal';
import ShareDialog from './ShareDialog';
import RenameFileDialog from '@/pages/Role/Project/ProjectDetails/RenameFileDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileViewerProps {
  files: any[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onUpdate?: (updatedFile: any) => void;
  targetType?: 'document' | 'photo' | string;
  projectId?: string | number;
  onCreateSnag?: (photo: any) => void;
  onCreateRfi?: (photo: any) => void;
  initialTab?: null | 'links';
  initialOpenLinkModal?: boolean;
}

const FileViewer = ({ files, initialIndex, open, onOpenChange, user, onUpdate, targetType = 'photo', projectId, onCreateSnag, onCreateRfi, initialTab, initialOpenLinkModal }: FileViewerProps) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const [localActiveFile, setLocalActiveFile] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [promotingVersionId, setPromotingVersionId] = useState<number | string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<number | string | null>(null);

  // Reset zoom, pan and rotation when changing files
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setLocalActiveFile(null);
  }, [currentIndex]);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [shareItem, setShareItem] = useState<any | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  const handleRename = async (newName: string) => {
    try {
      await updateFile(currentFile.id, { file_name: newName });
      toast.success(t('file_renamed_msg').replace('{name}', newName));
      if (onUpdate) {
        onUpdate({ ...currentFile, file_name: newName });
      }
    } catch (e: any) {
      toast.error(t('failed_rename_file') || 'Failed to rename file');
    }
  };

  const handleToggleDoNotFollow = async () => {
    try {
      const targetState = !currentFile.do_not_follow;
      await toggleDoNotFollow(currentFile.id, targetState);
      toast.success(t(targetState ? 'doc_marked_dnf' : 'doc_unmarked_dnf'));
      if (onUpdate) {
        onUpdate({ ...currentFile, do_not_follow: targetState });
      }
    } catch (e: any) {
      toast.error(t('failed_toggle_dnf') || 'Failed to toggle Do Not Follow');
    }
  };

  const handleToggleOnlyForReference = async () => {
    try {
      const targetState = !currentFile.only_for_reference;
      await toggleOnlyForReference(currentFile.id, targetState);
      toast.success(t(targetState ? 'doc_marked_ofr' : 'doc_unmarked_ofr'));
      if (onUpdate) {
        onUpdate({ ...currentFile, only_for_reference: targetState });
      }
    } catch (e: any) {
      toast.error(t('failed_toggle_ofr') || 'Failed to toggle Only for Reference');
    }
  };
  const [linkedItems, setLinkedItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'discussion' | 'links' | 'versions'>('discussion');
  const [linksSubTab, setLinksSubTab] = useState<'rfi' | 'snag' | 'photo' | 'doc'>('rfi');

  const isFilePhoto = (item: any) => {
    const name = (item.title || item.file_name || item.name || '').toLowerCase();
    return item.file_type?.startsWith('image/') ||
        name.endsWith('.jpg') || name.endsWith('.jpeg') ||
        name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp');
  };

  const linkedDocs = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && !isFilePhoto(i));
  const linkedPhotos = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && isFilePhoto(i));
  const linkedRFIs = linkedItems.filter(i => i.type === 'rfi' || i.target_type === 'rfi');
  const linkedSnags = linkedItems.filter(i => i.type === 'snag' || i.target_type === 'snag');

  const linkedSubTabs = [
    ...(linkedRFIs.length > 0 ? [{ key: 'rfi' as const, label: `${t('rfi_label')} (${linkedRFIs.length})`, color: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-500/10' }] : []),
    ...(linkedSnags.length > 0 ? [{ key: 'snag' as const, label: `${t('snags')} (${linkedSnags.length})`, color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-500/10' }] : []),
    ...(linkedPhotos.length > 0 ? [{ key: 'photo' as const, label: `${t('photos')} (${linkedPhotos.length})`, color: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500/10' }] : []),
    ...(linkedDocs.length > 0 ? [{ key: 'doc' as const, label: `${t('documents')} (${linkedDocs.length})`, color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-500/10' }] : []),
  ];

  const activeLinksSubTab = linkedSubTabs.find(s => s.key === linksSubTab)
    ? linksSubTab
    : (linkedSubTabs[0]?.key || 'rfi');

  const parentFile = files[currentIndex];
  const currentFile = localActiveFile || parentFile;
  const isImage = currentFile?.file_type?.toLowerCase().includes('image') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => currentFile?.file_name?.toLowerCase().endsWith(ext));
  const isPdf = currentFile?.file_type?.toLowerCase().includes('pdf') ||
    currentFile?.file_name?.toLowerCase().endsWith('.pdf');

  const fetchLinks = useCallback(async () => {
    if (currentFile?.id) {
      try {
        const data = await getLinkedItems(currentFile.id);
        setLinkedItems(data.links || []);
      } catch (err) {
        console.error(err);
      }
    }
  }, [currentFile?.id]);

  const fetchVersions = useCallback(async () => {
    const rootFile = parentFile;
    if (rootFile?.id) {
      setLoadingVersions(true);
      try {
        const data = await getFileVersions(rootFile.id);
        setVersions(data.versions || []);
      } catch (err) {
        console.error("fetchVersions Error", err);
      } finally {
        setLoadingVersions(false);
      }
    }
  }, [parentFile?.id]);

  const handlePromoteVersion = async (fileId: string | number) => {
    try {
      setPromotingVersionId(fileId);
      await promoteFile(fileId);
      toast.success(t('version_promoted_success') || 'Version promoted to current active version');
      fetchVersions();
      const promoted = versions.find(v => v.id === fileId);
      if (promoted) {
        setLocalActiveFile(promoted);
        if (onUpdate) {
          onUpdate({ ...promoted, is_current: true });
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to promote version');
    } finally {
      setPromotingVersionId(null);
    }
  };

  const handleDeleteVersion = async (fileId: string | number) => {
    if (!confirm(t('confirm_delete_version') || 'Are you sure you want to delete this version?')) return;
    try {
      setDeletingVersionId(fileId);
      await deleteFile(fileId);
      toast.success(t('version_deleted_success') || 'Version deleted successfully');
      if (fileId === currentFile.id) {
        const remaining = versions.filter(v => v.id !== fileId);
        if (remaining.length > 0) {
          setLocalActiveFile(remaining[0]);
          if (onUpdate) {
            onUpdate({ ...remaining[0], is_current: true });
          }
        } else {
          onOpenChange(false);
        }
      }
      fetchVersions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete version');
    } finally {
      setDeletingVersionId(null);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLinks();
      fetchVersions();
    }
  }, [open, fetchLinks, fetchVersions]);

  useEffect(() => {
    if (open && initialOpenLinkModal) {
      setShowLinkModal(true);
      setActiveTab('links');
    }
  }, [open, initialOpenLinkModal]);

  const handleLinkFile = async (targetId: string | number) => {
    try {
      await linkFiles(currentFile.id, targetId);
      toast.success(t('file_linked_success'));
      setShowLinkModal(false);
      fetchLinks();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('file_link_failed'));
    }
  };

  const handleRemoveLink = async (targetType: string, targetId: string | number) => {
    try {
      await deleteLink(currentFile.id, targetType, targetId);
      toast.success(t('link_removed_success'));
      fetchLinks();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('link_remove_failed'));
    }
  };

  const handleLinkItemClick = (item: any) => {
    setShowLinkModal(false);
    const currentUrlParams = new URLSearchParams(window.location.search);
    const currentTab = currentUrlParams.get('tab') || 'documents';
    const currentFolderId = currentUrlParams.get('folder');
    if (item.type === 'file') {
      const idx = files.findIndex(f => String(f.id) === String(item.id));
      if (idx !== -1) {
        setCurrentIndex(idx);
      } else {
        onOpenChange(false);
        const targetTab = (item.file_type?.toLowerCase().includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.url || '')) ? 'photos' : 'documents';
        const extraParams = new URLSearchParams();
        extraParams.set('tab', targetTab);
        let folderId = item.folder_id;
        if (!folderId) {
          const urlToParse = item.url || item.file_url;
          if (urlToParse) {
            const match = urlToParse.match(/folders\/([^/]+)/);
            if (match) folderId = match[1];
          }
        }
        if (folderId) extraParams.set('folder', String(folderId));
        extraParams.set('fileId', String(item.file_id || item.id));
        extraParams.set('viewerTab', 'links');
        if (currentFile?.id) {
          extraParams.set('returnTab', currentTab);
          if (currentFolderId) extraParams.set('returnFolderId', currentFolderId);
          extraParams.set('returnFileId', String(currentFile.id));
          extraParams.set('returnViewerTab', 'links');
        }
        setTimeout(() => {
          router.push(window.location.pathname + `?${extraParams.toString()}`);
        }, 300);
      }
    } else {
      // Navigate to RFI or Snag with return context so closing it brings back here
      onOpenChange(false);
      if (item.url) {
        try {
          // Parse the target URL to extract path and params
          const hasPath = item.url.includes('?');
          const [urlPath, queryStr] = hasPath ? item.url.split('?') : [item.url, ''];
          const targetParams = new URLSearchParams(queryStr);

          // Add return context
          targetParams.set('returnTab', currentTab);
          if (currentFile?.id) targetParams.set('returnFileId', String(currentFile.id));
          if (currentFolderId) targetParams.set('returnFolderId', currentFolderId);

          // Determine if this is an absolute URL or just query params
          const newUrl = urlPath ? `${urlPath}?${targetParams.toString()}` : `${window.location.pathname}?${targetParams.toString()}`;
          setTimeout(() => {
            router.push(newUrl);
          }, 300);
        } catch {
          setTimeout(() => {
            router.push(item.url);
          }, 300);
        }
      }
    }
  };

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setLocalActiveFile(null);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [open, initialIndex, initialTab]);

  // Mark as seen if assigned to current user
  useEffect(() => {
    if (open && currentFile && user?.id) {
      const isAssignedToMe = Array.isArray(currentFile.assigned_to)
        ? currentFile.assigned_to.map(String).includes(String(user.id))
        : currentFile.assigned_to && String(currentFile.assigned_to) === String(user.id);
      if (isAssignedToMe && !currentFile.seen_at) {
        markFileSeen(currentFile.id).catch(console.error);
      }
    }
  }, [open, currentIndex, currentFile, user?.id]);



  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % files.length);
  }, [files.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + files.length) % files.length);
  }, [files.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((isInput || showLinkModal) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        return;
      }

      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goNext, goPrev, onOpenChange, showLinkModal]);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Handle Mouse Wheel Zoom
  useEffect(() => {
    if (!open) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if we are interacting with the viewer or its children
      const isOverViewer = viewerRef.current?.contains(e.target as Node);
      if (!isOverViewer) return;

      if (!isImage && !isPdf) return;

      // Stop the browser from zooming/scrolling the page
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const currentZoom = zoomRef.current;
      const newZoom = Math.min(Math.max(currentZoom + delta, 1), 5);

      if (newZoom !== currentZoom) {
        setZoom(newZoom);
        if (newZoom <= 1) setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [open, isImage, isPdf]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };

  const handleDownload = async () => {
    if (!currentFile?.downloadUrl || downloading) return;
    setDownloading(true);
    try {
      let blob;
      // If it's a PDF and marked as 'Do Not Follow', download via backend to apply watermark
      if ((currentFile.do_not_follow || currentFile.only_for_reference) && currentFile.file_type === 'application/pdf') {
        blob = await downloadFile(currentFile.id);
      } else {
        const response = await fetch(currentFile.downloadUrl);
        blob = await response.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', currentFile.file_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to simple link if fetch fails (e.g. CORS)
      window.open(currentFile.downloadUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };


  if (!currentFile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={cn(
        "max-w-[100vw] md:max-w-[95vw] w-full h-full md:h-[90vh] p-0 overflow-hidden bg-background text-foreground border-none shadow-2xl transition-all duration-300"
      )}>
        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden">

          {/* Column 1: Details Sidebar (Visible on Desktop, Bottom on Mobile) */}
          <div className={cn(
            "w-full md:w-[350px] lg:w-[400px] border-r border-border bg-card/30 backdrop-blur-xl flex flex-col shrink-0 order-2 md:order-1",
            isFullscreen && "hidden"
          )}>
            {/* Sidebar Header */}
            <div className="p-6 border-b border-border/50 bg-background/50">
              <span className="text-[10px] font-black tracking-[0.2em] opacity-50 uppercase block mb-1">
                {t('file_details')}
              </span>
              <h3 className="text-lg font-bold truncate leading-tight">
                {currentFile.file_name}
              </h3>
            </div>

            {/* Sidebar Content (Non-scrolling parent) */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Metadata & Actions (Fixed height section) */}
              <div className="p-6 space-y-6 shrink-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('uploaded_by')}</span>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] font-bold text-foreground">{currentFile.creator?.name || t('system_label')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('date')}</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] font-bold text-foreground">{formatDate(currentFile.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('size_label')}</span>
                    <span className="text-[11px] font-bold text-foreground ml-0.5">{formatFileSize(currentFile.file_size_mb)}</span>
                  </div>
                  {currentFile.location && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('location_label')}</span>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-accent" />
                        <span className="text-[11px] font-bold text-foreground truncate">{currentFile.location}</span>
                      </div>
                    </div>
                  )}
                </div>

                {(currentFile?.tags) && (
                  <div className="flex flex-col -mt-2 gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">tags</span>

                    {currentFile?.tags && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <div className="w-[22px] h-[22px] rounded-full bg-white/10 flex items-center justify-center">
                          <TagIcon className="h-3 w-3 text-white" />
                        </div>
                        {currentFile.tags.split(',').map((tag: string, tidx: number) => (
                          <div key={tidx} className="bg-white/15 px-2.5 h-[22px] rounded-lg border border-white/10 flex items-center justify-center">
                            <span className="text-white text-[10px] font-semibold leading-none">{tag.trim()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    className={cn("w-full h-11 text-[11px] font-black rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all active:scale-95", downloading && "opacity-50 pointer-events-none")}
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download className="h-4 w-4 mr-2" /> {downloading ? t('downloading_label') : t('download_file')}
                  </Button>
                </div>
              </div>

              {/* Comments Section (Fills remaining height) */}
              <div className="flex-1 flex flex-col min-h-0 border-t border-border/50">
                <div className="px-6 py-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center gap-4 mb-4 shrink-0 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setActiveTab('discussion')}
                      className={cn("flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors relative whitespace-nowrap", activeTab === 'discussion' ? "text-accent" : "text-muted-foreground hover:text-foreground")}
                    >
                      {activeTab === 'discussion' && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                      {t('discussion')}
                    </button>
                    <button
                      onClick={() => setActiveTab('links')}
                      className={cn("flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors relative whitespace-nowrap", activeTab === 'links' ? "text-accent" : "text-muted-foreground hover:text-foreground")}
                    >
                      {activeTab === 'links' && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                      {t('links_label')} ({linkedItems.length})
                    </button>
                    {targetType === 'document' && (
                      <button
                        onClick={() => setActiveTab('versions')}
                        className={cn("flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors relative whitespace-nowrap", activeTab === 'versions' ? "text-accent" : "text-muted-foreground hover:text-foreground")}
                      >
                        {activeTab === 'versions' && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                        {t('versions') || 'Versions'} ({versions.length})
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col">
                    {activeTab === 'discussion' ? (
                      <div className="flex-1 overflow-y-auto">
                        <CommentThread targetId={currentFile.id} targetType={targetType} projectId={projectId || currentFile.project_id} />
                      </div>
                    ) : activeTab === 'versions' ? (
                      <div className="flex flex-col h-full min-h-0">
                        {loadingVersions ? (
                          <div className="text-center py-8 text-xs text-muted-foreground">{t('loading_versions') || 'Loading versions...'}</div>
                        ) : versions.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground">{t('no_versions') || 'No versions found'}</div>
                        ) : (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
                            {versions.map((v, idx) => {
                              const isActiveVersion = currentFile.id === v.id;
                              const isCurrentVersion = v.is_current;
                              return (
                                <div 
                                  key={v.id} 
                                  onClick={() => setLocalActiveFile(v)}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                    isActiveVersion 
                                      ? "bg-accent/10 border-accent shadow-sm" 
                                      : "bg-secondary/50 border-border/50 hover:bg-secondary"
                                  )}
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                                        V{versions.length - idx}
                                      </span>
                                      {isCurrentVersion && (
                                        <span className="bg-emerald-500/10 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                                          {t('current_version') || 'Active'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm font-semibold truncate text-foreground">{v.file_name}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {formatDate(v.createdAt)} &bull; {v.creator?.name || t('system_label')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {!isCurrentVersion && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 text-[10px] font-black uppercase text-accent hover:bg-accent/10 px-2"
                                        onClick={() => handlePromoteVersion(v.id)}
                                        disabled={promotingVersionId !== null || deletingVersionId !== null}
                                      >
                                        {promotingVersionId === v.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin text-accent" />
                                        ) : (
                                          t('make_active') || 'Make Active'
                                        )}
                                      </Button>
                                    )}
                                    {(user.role === 'admin' || user.role === 'superadmin' || String(v.created_by) === String(user.id)) && (
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive" 
                                        onClick={() => handleDeleteVersion(v.id)} 
                                        title={t('delete')}
                                        disabled={promotingVersionId !== null || deletingVersionId !== null}
                                      >
                                        {deletingVersionId === v.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col h-full min-h-0">
                        {linkedItems.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground">{t('no_linked_items')}</div>
                        ) : (
                          <>
                            {linkedSubTabs.length > 0 && (
                              <div className="flex border border-border/30 bg-secondary/20 rounded-lg p-0.5 shrink-0 overflow-x-auto gap-1 mb-4 no-scrollbar">
                                {linkedSubTabs.map(st => {
                                  const isActive = activeLinksSubTab === st.key;
                                  return (
                                    <button
                                      key={st.key}
                                      onClick={() => setLinksSubTab(st.key)}
                                      className={cn(
                                        "flex-1 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all rounded-md whitespace-nowrap",
                                        isActive 
                                          ? `${st.color} ${st.bg} shadow-sm border border-border/40 font-black` 
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/10 border border-transparent"
                                      )}
                                    >
                                      {st.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
                              {(() => {
                                let itemsToRender = [];
                                if (activeLinksSubTab === 'rfi') itemsToRender = linkedRFIs;
                                if (activeLinksSubTab === 'snag') itemsToRender = linkedSnags;
                                if (activeLinksSubTab === 'photo') itemsToRender = linkedPhotos;
                                if (activeLinksSubTab === 'doc') itemsToRender = linkedDocs;

                                if (itemsToRender.length === 0) {
                                  return <div className="text-center py-8 text-xs text-muted-foreground">{t('no_linked_items')}</div>;
                                }

                                return itemsToRender.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
                                    <div
                                      className="flex-1 min-w-0 pr-2 cursor-pointer hover:opacity-85 transition-opacity"
                                      onClick={() => handleLinkItemClick(item)}
                                    >
                                      <div className="text-[10px] uppercase font-bold text-accent mb-1 tracking-wider">{item.type}</div>
                                      <div className="text-sm font-semibold truncate text-foreground">{item.title}</div>
                                      {item.status && <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.status}</div>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-accent" onClick={() => handleLinkItemClick(item)} title={t('view_btn')}>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveLink(item.type, item.id)} title={t('remove_link')}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Main Content Area (Image/Viewer) */}
          <div className="flex-1 relative flex flex-col bg-muted/10 dark:bg-black/40 overflow-hidden group order-1 md:order-2">

            {/* Top Bar Controls (Floating) */}
            <div className="absolute top-0 left-0 right-0 z-[120] flex items-center justify-between p-4 bg-gradient-to-b from-background/80 via-background/30 to-transparent dark:from-black/60 dark:via-black/20 backdrop-blur-[2px]">
              <div className="flex flex-col pl-2">
                <span className="text-[10px] font-black tracking-[0.2em] opacity-70 uppercase">
                  {currentIndex + 1} / {files.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-background border border-border text-foreground">
                    {onCreateRfi && (
                      <DropdownMenuItem onClick={() => onCreateRfi(currentFile)} className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{t('create_rfi')}</span>
                      </DropdownMenuItem>
                    )}
                    {onCreateSnag && (
                      <DropdownMenuItem onClick={() => onCreateSnag(currentFile)} className="cursor-pointer">
                        <AlertTriangle className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{t('create_snag')}</span>
                      </DropdownMenuItem>
                    )}
                    {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'contributor') && (
                      <DropdownMenuItem onClick={() => setShowRenameDialog(true)} className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{t('rename_btn')}</span>
                      </DropdownMenuItem>
                    )}
                    {targetType === 'document' && (user?.role === 'admin' || user?.role === 'superadmin' || (user?.role === 'contributor' && (String(currentFile.created_by) === String(user.id) || String(currentFile.creator?.id) === String(user.id)))) && (
                      <>
                        <DropdownMenuItem onClick={handleToggleDoNotFollow} className="cursor-pointer">
                          <ShieldAlert className={`mr-2 h-4 w-4 ${currentFile.do_not_follow ? 'text-red-500' : 'text-muted-foreground'}`} />
                          <span>{t('toggle_dnf_tip')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleToggleOnlyForReference} className="cursor-pointer">
                          <Info className={`mr-2 h-4 w-4 ${currentFile.only_for_reference ? 'text-blue-500' : 'text-muted-foreground'}`} />
                          <span>{t('toggle_ofr_tip')}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setShareItem(currentFile)} className="cursor-pointer">
                      <Share2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{t('share_btn')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  className="h-9 px-3 gap-1.5 backdrop-blur-md rounded-full text-[11px] font-black uppercase bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80"
                  onClick={() => setShowLinkModal(true)}
                >
                  <LinkIcon className="h-3.5 w-3.5" /> {t('link')}
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => window.open(currentFile.downloadUrl, '_blank')} title={t('view_original')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>

                {(isImage || isPdf) && (
                  <>
                    <div className="h-4 w-[1px] bg-border/50 mx-1" />
                    <Button size="icon" variant="ghost" className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => {
                      setZoom(z => { const nz = Math.max(z - 0.5, 1); if (nz <= 1) setPan({ x: 0, y: 0 }); return nz; });
                    }} title={t('zoom_out')}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => setZoom(z => Math.min(z + 0.5, 5))} title={t('zoom_in')}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    {isImage && (
                      <Button size="icon" variant="ghost" className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => setRotation(r => (r + 90) % 360)} title={t('rotate')}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-9 w-9 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-md dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? t('exit_fullscreen') : t('fullscreen')}>
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-10 w-10 ml-2 backdrop-blur-md rounded-full bg-background/80 text-foreground border border-border/60 hover:bg-background shadow-xl dark:bg-black/60 dark:text-white dark:border-white/20 dark:hover:bg-black/80" onClick={() => onOpenChange(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Actual Viewer Area */}
            <div
              ref={viewerRef}
              className="flex-1 w-full min-h-0 flex items-center justify-center relative overflow-hidden"
              onMouseDown={(e) => {
                if (zoom > 1) {
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && zoom > 1) {
                  setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {/* Navigation Arrows */}
              <button
                onClick={goPrev}
                className="absolute left-0 top-0 bottom-0 w-[10%] z-[110] flex items-center justify-start pl-4 group/nav bg-transparent transition-all cursor-pointer"
              >
                <div className="h-12 w-12 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center text-foreground opacity-0 group-hover/nav:opacity-100 transition-all border border-border/50 shadow-2xl scale-90 group-hover/nav:scale-100">
                  <ChevronLeft className="h-6 w-6" />
                </div>
              </button>
              <button
                onClick={goNext}
                className="absolute right-0 top-0 bottom-0 w-[10%] z-[110] flex items-center justify-end pr-4 group/nav bg-transparent transition-all cursor-pointer"
              >
                <div className="h-12 w-12 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center text-foreground opacity-0 group-hover/nav:opacity-100 transition-all border border-border/50 shadow-2xl scale-90 group-hover/nav:scale-100">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </button>

              {isImage ? (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                >
                  <img
                    src={currentFile.downloadUrl}
                    alt={currentFile.file_name}
                    className="max-w-[90%] max-h-[90%] object-contain pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500"
                  />
                </div>
              ) : isPdf ? (
                <div
                  className="w-full h-full flex items-center justify-center p-4 md:p-8 transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                >
                  <iframe
                    src={`${currentFile.downloadUrl}#toolbar=0`}
                    className="w-full h-full border-none bg-white rounded-xl shadow-2xl z-10 pointer-events-auto"
                    style={{ pointerEvents: zoom > 1 ? 'none' : 'auto' }}
                    title={currentFile.file_name}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 text-center p-12 bg-card/50 rounded-[2.5rem] backdrop-blur-2xl border border-border/50 z-10 shadow-2xl mx-4">
                  <div className="p-8 bg-accent/10 rounded-full">
                    <FileText className="h-16 w-16 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-black tracking-tight">{currentFile.file_name}</p>
                    <p className="text-sm text-muted-foreground font-medium">{t('preview_not_available')}</p>
                  </div>
                </div>
              )}

              {/* Watermarks */}
              {(currentFile.do_not_follow || currentFile.only_for_reference) && (
                <div className="absolute inset-0 pointer-events-none z-[100] flex flex-col gap-8 md:gap-16 items-center justify-center overflow-hidden">
                  {currentFile.do_not_follow && (
                    <div className="transform -rotate-[30deg] border-4 md:border-[10px] border-dashed border-red-500/20 rounded-xl md:rounded-3xl px-8 py-4 md:px-20 md:py-10 bg-red-500/[0.02] select-none">
                      <h1 className="text-red-500/25 text-2xl md:text-3xl lg:text-5xl font-black uppercase tracking-widest text-center whitespace-nowrap">
                        {t('do_not_follow_tag')}
                      </h1>
                    </div>
                  )}
                  {currentFile.only_for_reference && (
                    <div className="transform -rotate-[30deg] border-4 md:border-[10px] border-dashed border-blue-500/20 rounded-xl md:rounded-3xl px-8 py-4 md:px-20 md:py-10 bg-blue-500/[0.02] select-none mt-4">
                      <h1 className="text-blue-500/25 text-2xl md:text-3xl lg:text-5xl font-black uppercase tracking-widest text-center whitespace-nowrap">
                        {t('only_for_reference_tag')}
                      </h1>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <LinkFileModal
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        projectId={projectId || currentFile?.project_id}
        currentFileId={currentFile?.id}
        onLink={handleLinkFile}
        handleLinkItemClick={handleLinkItemClick}
      />
      {shareItem && (
        <ShareDialog
          open={!!shareItem}
          onOpenChange={() => setShareItem(null)}
          itemName={shareItem?.file_name || ''}
          downloadUrl={shareItem?.downloadUrl}
          fileType={shareItem?.file_type}
        />
      )}
      <RenameFileDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        onRename={handleRename}
        currentName={currentFile?.file_name || ''}
      />
    </Dialog>
  );
};

export default FileViewer;
