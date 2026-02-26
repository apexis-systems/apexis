"use client";

import { Project } from '@/types';
import { FileText, Camera, MapPin } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

const ProjectCard = ({ project, onClick }: ProjectCardProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-card border border-border p-4 text-left transition-all hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex gap-4">
        {/* Color thumbnail */}
        <div
          className="h-16 w-16 flex-shrink-0 rounded-xl"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{project.name}</h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{project.location}</span>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>{project.totalDocs} docs</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
              <span>{project.totalPhotos} photos</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ProjectCard;
