"use client";

import { Project, UserRole } from '@/types';
import { mockReports } from '@/data/mock';
import { FileText, Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectDailyReportsProps {
  project: Project;
  userRole: UserRole;
}

const ProjectDailyReports = ({ project, userRole }: ProjectDailyReportsProps) => {
  const dailyReports = mockReports.filter(
    (r) => r.projectId === project.id && r.type === 'daily'
  );

  return (
    <div className="mt-3">
      {/* Upload Button */}
      {userRole !== 'client' && (
        <Button className="mb-3 w-full h-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold">
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Daily Report
        </Button>
      )}

      {/* Report List */}
      <div className="space-y-2">
        {dailyReports.map((report) => (
          <div
            key={report.id}
            className="flex items-center gap-2.5 rounded-lg bg-card border border-border p-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <FileText className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate">{report.title}</p>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                <Calendar className="h-2.5 w-2.5" />
                <span>{report.date}</span>
                <span>·</span>
                <span>{report.uploader}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {dailyReports.length === 0 && (
        <div className="mt-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-1.5 text-xs text-muted-foreground">No daily reports yet</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDailyReports;
