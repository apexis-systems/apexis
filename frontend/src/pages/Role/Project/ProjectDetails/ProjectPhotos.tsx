"use client";

import { useState } from 'react';
import { Project, User, ProjectPhoto, Folder } from '@/types';
import { mockPhotos, mockFolders } from '@/data/mock';
import { Camera, Upload, Eye, EyeOff, Folder as FolderIcon, ArrowLeft, FolderPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import CreateFolderDialog from './CreateFolderDialog';
import ShareDialog from '@/components/shared/ShareDialog';
import CommentThread from '@/components/shared/CommentThread';

interface ProjectPhotosProps {
  project: Project;
  user: User;
}

const ProjectPhotos = ({ project, user }: ProjectPhotosProps) => {
  const router = useRouter();
  const [photos, setPhotos] = useState<ProjectPhoto[]>(
    mockPhotos.filter((p) => p.projectId === project.id)
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>(
    mockFolders.filter((f) => f.projectId === project.id && f.type === 'photos')
  );
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [shareItem, setShareItem] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const currentFolderPhotos = selectedFolder
    ? photos.filter((p) => p.folderId === selectedFolder)
    : [];

  const visiblePhotos = user.role === 'client' ? currentFolderPhotos.filter((p) => p.clientVisible) : currentFolderPhotos;

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  const toggleVisibility = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, clientVisible: !p.clientVisible } : p))
    );
    toast.success('Photo visibility updated');
  };

  const handleUpload = () => {
    router.push(`/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder}`);
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: `folder-photo-${Date.now()}`,
      projectId: project.id,
      name,
      type: 'photos',
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
            const folderPhotos = photos.filter((p) => p.folderId === folder.id);
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
                  {folderPhotos.length} photos
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
          type="photos"
        />
      </div>
    );
  }

  // Photos Grid View
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
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Photos
        </Button>
      )}

      <div className="grid grid-cols-5 gap-0.5">
        {visiblePhotos.map((photo) => (
          <div key={photo.id} className="relative aspect-square bg-secondary">
            <button
              onClick={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Camera className="h-4 w-4 text-muted-foreground/30" />
            </button>
            <div className="absolute top-0.5 right-0.5 flex gap-0.5">
              <button
                onClick={() => setShareItem(`Photo - ${photo.location}`)}
                className="rounded-full bg-card/80 p-0.5 backdrop-blur-sm"
              >
                <Share2 className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => toggleVisibility(photo.id)}
                  className="rounded-full bg-card/80 p-0.5 backdrop-blur-sm"
                >
                  {photo.clientVisible ? (
                    <Eye className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Expanded photo comment */}
      {expandedPhoto && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground mb-1">
            {visiblePhotos.find((p) => p.id === expandedPhoto)?.location}
          </p>
          <CommentThread targetId={expandedPhoto} targetType="photo" />
        </div>
      )}

      {visiblePhotos.length === 0 && (
        <div className="mt-6 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No photos yet</p>
        </div>
      )}

      {shareItem && (
        <ShareDialog open={!!shareItem} onOpenChange={() => setShareItem(null)} itemName={shareItem} />
      )}
    </div>
  );
};

export default ProjectPhotos;
