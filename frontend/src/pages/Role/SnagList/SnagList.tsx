"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectSnagList from '@/pages/Role/Project/ProjectDetails/ProjectSnagList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProjects } from '@/services/projectService';

const SnagList = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');

    useEffect(() => {
        getProjects()
            .then((data: any) => {
                const list = data.projects || [];
                setProjects(list);
                if (list.length > 0) setSelectedId(String(list[0].id));
            })
            .catch(console.error);
    }, []);

    if (!user) return null;

    const project = projects.find(p => String(p.id) === selectedId) || projects[0];

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('snag_list')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and resolve project issues</p>
                </div>
                {projects.length > 1 && (
                    <Select value={selectedId} onValueChange={setSelectedId}>
                        <SelectTrigger className="w-56 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {project ? (
                <ProjectSnagList project={project} />
            ) : (
                <div className="mt-12 text-center text-muted-foreground">
                    <p>No projects available.</p>
                </div>
            )}
        </div>
    );
};

export default SnagList;
