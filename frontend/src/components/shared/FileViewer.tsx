"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tag as TagIcon, Plus, X, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, MapPin, Calendar, User as UserIcon, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import CommentThread from './CommentThread';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import { updateFile } from '@/services/fileService';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface FileViewerProps {
  files: any[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onUpdate?: (updatedFile: any) => void;
}

const FileViewer = ({ files, initialIndex, open, onOpenChange, user, onUpdate }: FileViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom and pan when changing files
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const currentFile = files[currentIndex];



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
      const response = await fetch(currentFile.downloadUrl);
      const blob = await response.blob();
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

  const isImage = currentFile.file_type?.startsWith('image/');
  const isPdf = currentFile.file_type?.includes('pdf');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={cn(
        "max-w-[100vw] md:max-w-7xl w-full h-full md:h-[95vh] p-0 overflow-hidden flex flex-col bg-background text-foreground border-none shadow-2xl transition-all duration-300"
      )}>
        {/* Main Content Area (Background) */}
        <div className="relative flex-1 flex flex-col items-center bg-muted/20 dark:bg-black overflow-hidden group">
          
          {/* Top Bar Controls (Floating) */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-background/80 to-transparent">
            <div className="flex flex-col pl-2">
               <span className="text-[10px] font-black tracking-[0.2em] opacity-50 uppercase">
                {currentIndex + 1} / {files.length}
              </span>
              <h3 className="text-sm font-bold truncate max-w-[40vw]">
                {currentFile.file_name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 pr-2">
              <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => window.open(currentFile.downloadUrl, '_blank')} title="View Original">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className={cn("hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full transition-all", downloading && "animate-pulse")} 
                onClick={handleDownload}
                title="Download"
                disabled={downloading}
              >
                <Download className="h-4 w-4" />
              </Button>
              {isImage && (
                <>
                  <div className="h-4 w-[1px] bg-border mx-1" />
                  <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => {
                    setZoom(z => { const nz = Math.max(z - 0.5, 1); if(nz <= 1) setPan({x:0, y:0}); return nz; });
                  }} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => setZoom(z => Math.min(z + 0.5, 5))} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-9 w-9 backdrop-blur-md rounded-full" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" className="hover:bg-accent/10 h-10 w-10 ml-2 backdrop-blur-md rounded-full border border-border" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Actual Content Area */}
          <div 
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
            {/* Navigation Arrows (Large Overlays) */}
            <button
              onClick={goPrev}
              className="absolute left-0 top-0 bottom-0 w-[15%] z-20 flex items-center justify-start pl-4 group/nav bg-transparent transition-all cursor-pointer"
            >
              <div className="h-14 w-14 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center text-foreground opacity-0 group-hover/nav:opacity-100 transition-opacity border border-border">
                <ChevronLeft className="h-8 w-8" />
              </div>
            </button>
            <button
              onClick={goNext}
              className="absolute right-0 top-0 bottom-0 w-[15%] z-20 flex items-center justify-end pr-4 group/nav bg-transparent transition-all cursor-pointer"
            >
              <div className="h-14 w-14 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center text-foreground opacity-0 group-hover/nav:opacity-100 transition-opacity border border-border">
                <ChevronRight className="h-8 w-8" />
              </div>
            </button>

            {isImage ? (
              <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{ 
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
              >
                <img
                  src={currentFile.downloadUrl}
                  alt={currentFile.file_name}
                  className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
                />
              </div>
            ) : isPdf ? (
              <iframe
                src={`${currentFile.downloadUrl}#toolbar=0`}
                className="w-full h-full border-none bg-white md:max-w-5xl md:h-[95%] md:my-auto md:rounded-lg shadow-2xl z-10"
                title={currentFile.file_name}
              />
            ) : (
              <div className="flex flex-col items-center gap-6 text-center p-12 bg-card rounded-[2.5rem] backdrop-blur-xl border border-border z-10 shadow-2xl">
                <div className="p-8 bg-accent/10 rounded-full">
                  <FileText className="h-20 w-20 text-accent" />
                </div>
                <div className="space-y-3">
                  <p className="text-xl font-black tracking-tight">{currentFile.file_name}</p>
                  <p className="text-sm text-muted-foreground font-medium">Preview not available for this file type</p>
                </div>
                <Button 
                  variant="outline" 
                  className={cn("mt-6 border-border text-foreground hover:bg-accent hover:text-accent-foreground transition-all px-8 h-12 rounded-full font-bold shadow-lg", downloading && "opacity-50 pointer-events-none")} 
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  <Download className="h-4 w-4 mr-2" /> {downloading ? 'Downloading...' : 'Download File'}
                </Button>
              </div>
            )}
          </div>

          {/* Bottom Panel (Fixed height, scrollable content) */}
          {!isFullscreen && (
            <div className={cn(
              "w-full bg-background border-t border-border flex flex-col pt-2 shrink-0",
              isImage ? "h-[35vh] md:h-[40vh]" : "h-auto p-4"
            )}>
            {/* Metadata Bar */}
            <div className="px-6 pb-4 flex flex-wrap items-center justify-between gap-y-4 gap-x-12 border-b border-border/50">
              <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <UserIcon className="h-4 w-4 text-accent" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">Uploaded By</span>
                    <span className="text-[11px] font-black text-foreground leading-none">{currentFile.creator?.name || 'SYSTEM'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-accent" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">Date</span>
                    <span className="text-[11px] font-black text-foreground leading-none">{formatDate(currentFile.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col ml-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1 ml-0.5">Size</span>
                    <span className="text-[11px] font-black text-foreground leading-none">{formatFileSize(currentFile.file_size_mb)}</span>
                  </div>
                </div>
                {currentFile.location && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-accent" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">Location</span>
                      <span className="text-[11px] font-black text-foreground leading-none truncate max-w-[200px]">{currentFile.location}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                 <Button 
                   size="sm" 
                   className={cn("h-9 text-[10px] font-black rounded-full px-5 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all active:scale-95", downloading && "opacity-50 pointer-events-none")} 
                   onClick={handleDownload}
                   disabled={downloading}
                 >
                   <Download className="h-3.5 w-3.5 mr-2" /> {downloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
                 </Button>
              </div>
            </div>

            {/* Metadata & Discussion Section (Photo Only) */}
            {isImage ? (
              <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
                {/* Comments & Tags Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">Comments & Tags</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <CommentThread targetId={currentFile.id} targetType="photo" projectId={currentFile.project_id} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileViewer;
