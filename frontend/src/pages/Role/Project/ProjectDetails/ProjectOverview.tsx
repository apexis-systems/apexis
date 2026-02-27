"use client";

import { Project, UserRole } from '@/types';
import { mockReports } from '@/data/mock';
import { CalendarDays, FileText, Camera, Upload, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectOverviewProps {
  project: Project;
  userRole: UserRole;
}

const ProjectOverview = ({ project, userRole }: ProjectOverviewProps) => {
  if (!project) return <div className="p-4 text-center text-sm text-muted-foreground">Loading project overview...</div>;

  const reports = mockReports.filter((r) => r.projectId === project.id);
  const dailyReports = reports.filter((r) => r.type === 'daily');
  const weeklyReports = reports.filter((r) => r.type === 'weekly');

  return (
    <div className="mt-4 space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs">Start Date</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{project.startDate}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs">End Date</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{project.endDate}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Documents</span>
          </div>
          <div className="mt-1 text-xl font-bold">{project.totalDocs}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4" />
            <span className="text-xs">Photos</span>
          </div>
          <div className="mt-1 text-xl font-bold">{project.totalPhotos}</div>
        </div>
      </div>

      {/* Reports Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Reports</h2>
          {userRole === 'admin' && (
            <Button size="sm" className="h-8 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 text-xs">
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload Report
            </Button>
          )}
        </div>

        {/* Daily Reports */}
        {dailyReports.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Daily Site Reports</p>
            <div className="space-y-2">
              {dailyReports.map((report) => (
                <div key={report.id} className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{report.title}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{report.date}</span>
                      <span>· {report.uploader}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Reports */}
        {weeklyReports.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Weekly Progress Reports</p>
            <div className="space-y-2">
              {weeklyReports.map((report) => (
                <div key={report.id} className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                    <FileText className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{report.title}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{report.date}</span>
                      <span>· {report.uploader}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Handover */}
      {userRole === 'admin' && (
        <Button variant="outline" className="w-full h-11 rounded-xl border-dashed text-sm">
          <Download className="h-4 w-4 mr-2" /> Export Final Handover Package
        </Button>
      )}
    </div>
  );
};

export default ProjectOverview;
