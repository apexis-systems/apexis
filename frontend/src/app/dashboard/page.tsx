"use client";

import { useAuth } from '@/contexts/AuthContext';
import { mockProjects } from '@/data/mock';
import { FileText, Camera, MapPin, CalendarDays, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const { user } = useAuth() || {};
    const router = useRouter();

    if (!user) {
        // Return a placeholder or a loading state while redirecting or waiting for auth
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Please log in to view the dashboard.</p>
            </div>
        );
    }

    const filteredProjects = mockProjects.filter((project) => {
        if (user.role === 'admin') return true;
        if (user.role === 'contributor') return project.assignedTo.includes(user.id);
        if (user.role === 'client') return project.sharedWith.includes(user.id);
        return false;
    });

    const totalDocs = filteredProjects.reduce((sum, p) => sum + p.totalDocs, 0);
    const totalPhotos = filteredProjects.reduce((sum, p) => sum + p.totalPhotos, 0);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Greeting with Logo */}
            <div className="mb-8 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                    <span className="text-[10px] text-muted-foreground">Logo</span>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Welcome back, {user.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {user.role === 'admin' && 'Manage all your company projects'}
                        {user.role === 'contributor' && 'View and contribute to your assigned projects'}
                        {user.role === 'client' && 'Access your shared project files'}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">Total Projects</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{filteredProjects.length}</div>
                </div>
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">Documents</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{totalDocs}</div>
                </div>
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">Photos</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{totalPhotos}</div>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Your Projects</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                    <button
                        key={project.id}
                        onClick={() => router.push(`/dashboard/project/${project.id}`)}
                        className="rounded-xl bg-card border border-border p-5 text-left hover:border-accent transition-colors group cursor-pointer"
                    >
                        {/* Color bar */}
                        <div
                            className="h-2 w-12 rounded-full mb-4"
                            style={{ backgroundColor: project.color }}
                        />

                        <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                            {project.name}
                        </h3>

                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {project.location}
                        </div>

                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {project.startDate} — {project.endDate}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="font-medium text-foreground">{project.totalDocs}</span> docs
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Camera className="h-3.5 w-3.5" />
                                <span className="font-medium text-foreground">{project.totalPhotos}</span> photos
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                    </button>
                ))}
            </div>

            {filteredProjects.length === 0 && (
                <div className="mt-12 text-center">
                    <p className="text-muted-foreground">No projects available for your role</p>
                </div>
            )}
        </div>
    );
}
