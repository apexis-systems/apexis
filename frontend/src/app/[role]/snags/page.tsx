"use client";

import { useState } from 'react';
import { mockProjects } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectSnagList from '@/components/project/ProjectSnagList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SnagListPage = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [selectedProjectId, setSelectedProjectId] = useState(mockProjects[0]?.id || '');

    if (!user) return null;

    const filteredProjects = mockProjects.filter((project) => {
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        if (user.role === 'contributor') return project.assignedTo.includes(user.id);
        if (user.role === 'client') return project.sharedWith.includes(user.id);
        return false;
    });

    const project = filteredProjects.find((p) => p.id === selectedProjectId) || filteredProjects[0];

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('snag_list')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and resolve project issues</p>
                </div>
                <Select value={project?.id || ''} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-56 text-xs">
                        <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {project ? (
                <ProjectSnagList project={project} />
            ) : (
                <div className="mt-12 text-center text-muted-foreground">
                    <p>No projects available to view snags for.</p>
                </div>
            )}
        </div>
    );
};

export default SnagListPage;
