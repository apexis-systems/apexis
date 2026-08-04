"use client";

import { useState, useEffect, useCallback } from 'react';
import { Project, User } from '@/types';
import { Camera, ArrowLeft, Folder as FolderIcon, Loader2, RefreshCw, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getProjectPhotosPaginated } from '@/services/projectService';
import FileViewer from '@/components/shared/FileViewer';
import { useLanguage } from '@/contexts/LanguageContext';

interface PhotoLibraryProps {
  project: Project;
  user: User;
  onBack?: () => void;
}

const PhotoLibrary = ({ project, user, onBack }: PhotoLibraryProps) => {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [viewerState, setViewerState] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchPhotos = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!project?.id) return;
    try {
      if (pageNum === 1 && !append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const data = await getProjectPhotosPaginated(project.id, pageNum, 36);
      const fetchedPhotos = data.photos || [];

      if (append) {
        setPhotos(prev => [...prev, ...fetchedPhotos]);
      } else {
        setPhotos(fetchedPhotos);
      }

      setPage(pageNum);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalPhotos(data.pagination.total || fetchedPhotos.length);
      }
    } catch (error: any) {
      console.error('Fetch project photos failed:', error);
      toast.error(error?.response?.data?.error || t('failed_load_photos') || 'Failed to load project photo library.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [project?.id, t]);

  useEffect(() => {
    if (isAdminUser) {
      fetchPhotos(1);
    }
  }, [fetchPhotos, isAdminUser]);

  if (!isAdminUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border">
        <div className="p-4 bg-destructive/10 text-destructive rounded-full mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Access Denied</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Only administrators and superadmins can access the project Photo Library.
        </p>
        {onBack && (
          <Button variant="outline" className="mt-6 gap-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Button>
        )}
      </div>
    );
  }

  const handleLoadMore = () => {
    if (loadingMore || page >= totalPages) return;
    fetchPhotos(page + 1, true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Photo Library</h2>
              <span className="bg-accent/10 text-accent text-xs font-bold px-2.5 py-0.5 rounded-full border border-accent/20">
                {totalPhotos} {totalPhotos === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Viewing all uploaded project images across folders and modules
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPhotos(1)}
          disabled={loading}
          className="gap-2 text-xs h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Grid Content */}
      {loading && photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <p className="text-xs text-muted-foreground animate-pulse">Loading photo library...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-card/40 rounded-2xl border border-dashed border-border">
          <div className="p-4 bg-secondary rounded-full mb-3 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Photos Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            This project does not have any uploaded photos in its library yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {photos.map((photo, index) => {
              const displayUrl = photo.downloadUrl || photo.file_url;
              const folderName = photo.folder?.name;

              return (
                <div
                  key={photo.id || index}
                  onClick={() => setViewerState({ open: true, index })}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-secondary/50 border border-border/60 hover:border-accent cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <img
                    src={displayUrl}
                    alt={photo.file_name || 'Project Photo'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Top Gradient & Folder Badge */}
                  <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent opacity-90 transition-opacity">
                    {folderName && (
                      <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white/90 border border-white/20 backdrop-blur-md">
                        <FolderIcon className="h-2.5 w-2.5 text-accent shrink-0" />
                        <span className="truncate">{folderName}</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom Hover Title */}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end">
                    <p className="text-[11px] font-bold text-white truncate leading-tight">
                      {photo.file_name}
                    </p>
                    {photo.creator?.name && (
                      <p className="text-[9px] text-white/70 truncate mt-0.5">
                        by {photo.creator.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {page < totalPages && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="gap-2 px-6 text-xs h-10 border-accent/30 hover:bg-accent/5 text-accent"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load More Photos ({photos.length} of {totalPhotos})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Full-Screen File Viewer Modal */}
      {viewerState.open && (
        <FileViewer
          files={photos}
          initialIndex={viewerState.index}
          open={viewerState.open}
          onOpenChange={(open) => setViewerState(prev => ({ ...prev, open }))}
          user={user}
          targetType="photo"
          projectId={project.id}
        />
      )}
    </div>
  );
};

export default PhotoLibrary;
