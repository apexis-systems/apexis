"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tag as TagIcon, Plus, X, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, MapPin, Calendar, User as UserIcon, Maximize2, Minimize2, ZoomIn, ZoomOut, ShieldAlert, RotateCw, Link as LinkIcon, Trash2 } from 'lucide-react';
import CommentThread from './CommentThread';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import { updateFile, downloadFile, markFileSeen, linkFiles, getLinkedItems, deleteLink } from '@/services/fileService';
import LinkFileModal from './LinkFileModal';
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
}

const FileViewer = ({ files, initialIndex, open, onOpenChange, user, onUpdate, targetType = 'photo', projectId, onCreateSnag, onCreateRfi }: FileViewerProps) => {
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

  // Reset zoom, pan and rotation when changing files
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [currentIndex]);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedItems, setLinkedItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'discussion'|'links'>('discussion');

  const currentFile = files[currentIndex];
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

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

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
    if (item.type === 'file') {
      const idx = files.findIndex(f => f.id === item.id);
      if (idx !== -1) {
        setCurrentIndex(idx);
      } else {
        if (item.url) {
          window.open(item.url, '_blank');
        }
      }
    } else {
      onOpenChange(false);
      if (item.url) {
        router.push(item.url);
      }
    }
  };

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Mark as seen if assigned to current user
  useEffect(() => {
    if (open && currentFile && user?.id) {
      if (currentFile.assigned_to && String(currentFile.assigned_to) === String(user.id) && !currentFile.seen_at) {
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
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goNext, goPrev, onOpenChange]);

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
      if (currentFile.do_not_follow && currentFile.file_type === 'application/pdf') {
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
                  <div className="flex items-center gap-4 mb-4 shrink-0 border-b border-border/50 pb-2">
                    <button 
                      onClick={() => setActiveTab('discussion')}
                      className={cn("flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors relative", activeTab === 'discussion' ? "text-accent" : "text-muted-foreground hover:text-foreground")}
                    >
                      {activeTab === 'discussion' && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                      {t('discussion')}
                    </button>
                    <button 
                      onClick={() => setActiveTab('links')}
                      className={cn("flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors relative", activeTab === 'links' ? "text-accent" : "text-muted-foreground hover:text-foreground")}
                    >
                      {activeTab === 'links' && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                      {t('links_label')} ({linkedItems.length})
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {activeTab === 'discussion' ? (
                      <CommentThread targetId={currentFile.id} targetType={targetType} projectId={projectId || currentFile.project_id} />
                    ) : (
                      <div className="space-y-3 pr-2">
                        {linkedItems.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground">{t('no_linked_items')}</div>
                        ) : (
                          linkedItems.map((item, idx) => (
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
                          ))
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
            <div className="absolute top-0 left-0 right-0 z-[120] flex items-center justify-between p-4 bg-gradient-to-b from-background/90 via-background/40 to-transparent backdrop-blur-[2px]">
              <div className="flex flex-col pl-2">
                 <span className="text-[10px] font-black tracking-[0.2em] opacity-60 uppercase">
                  {currentIndex + 1} / {files.length}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 pr-2">
                {onCreateRfi && (
                  <Button 
                    variant="ghost" 
                    className="hover:bg-accent/10 h-9 px-3 gap-1.5 backdrop-blur-md rounded-full text-[11px] font-black uppercase text-accent-foreground border border-border/50 bg-background/50 shadow-md" 
                    onClick={() => onCreateRfi(currentFile)}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('rfi_label')}
                  </Button>
                )}
                {onCreateSnag && (
                  <Button 
                    variant="ghost" 
                    className="hover:bg-accent/10 h-9 px-3 gap-1.5 backdrop-blur-md rounded-full text-[11px] font-black uppercase text-accent-foreground border border-border/50 bg-background/50 shadow-md" 
                    onClick={() => onCreateSnag(currentFile)}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('snag')}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  className="hover:bg-accent/10 h-9 px-3 gap-1.5 backdrop-blur-md rounded-full text-[11px] font-black uppercase text-accent-foreground border border-border/50 bg-background/50 shadow-md" 
                  onClick={() => setShowLinkModal(true)}
                >
                  <LinkIcon className="h-3.5 w-3.5" /> {t('link')}
                </Button>
                <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => window.open(currentFile.downloadUrl, '_blank')} title={t('view_original')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                
                {(isImage || isPdf) && (
                  <>
                    <div className="h-4 w-[1px] bg-border/50 mx-1" />
                    <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => {
                      setZoom(z => { const nz = Math.max(z - 0.5, 1); if(nz <= 1) setPan({x:0, y:0}); return nz; });
                    }} title={t('zoom_out')}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => setZoom(z => Math.min(z + 0.5, 5))} title={t('zoom_in')}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    {isImage && (
                      <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => setRotation(r => (r + 90) % 360)} title={t('rotate')}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? t('exit_fullscreen') : t('fullscreen')}>
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="hover:bg-accent/20 h-10 w-10 ml-2 backdrop-blur-md rounded-full border border-border/50 bg-background/50 shadow-xl" onClick={() => onOpenChange(false)}>
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

              {/* Watermark */}
              {currentFile.do_not_follow && (
                <div className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
                  <div className="transform -rotate-[30deg] border-4 md:border-[10px] border-dashed border-red-500/20 rounded-xl md:rounded-3xl px-8 py-4 md:px-20 md:py-10 bg-red-500/[0.02] select-none">
                    <h1 className="text-red-500/25 text-4xl md:text-8xl lg:text-9xl font-black uppercase tracking-widest text-center whitespace-nowrap">
                      {t('do_not_follow_tag')}
                    </h1>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      {showLinkModal && (
        <LinkFileModal
          open={showLinkModal}
          onOpenChange={setShowLinkModal}
          projectId={projectId || currentFile?.project_id}
          currentFileId={currentFile?.id}
          onLink={handleLinkFile}
        />
      )}
    </Dialog>
  );
};

export default FileViewer;
