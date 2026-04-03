"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectSnagList from '@/pages/Role/Project/ProjectDetails/ProjectSnagList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProjects } from '@/services/projectService';
import { getOrganizations } from '@/services/superadminService';

const SnagList = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [projects, setProjects] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [selectedId, setSelectedId] = useState<string>('');

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        getProjects(selectedOrgId)
            .then((data: any) => {
                const list = data.projects || [];
                setProjects(list);
                if (list.length > 0) {
                    // Update selection if current selection is not in list
                    if (!list.find((p: any) => String(p.id) === selectedId)) {
                        setSelectedId(String(list[0].id));
                    }
                } else {
                    setSelectedId('');
                }
            })
            .catch(console.error);
    }, [selectedOrgId]);

    if (!user) return null;

    const project = projects.find(p => String(p.id) === selectedId) || projects[0];

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('snag_list')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and resolve project issues</p>
                </div>
                <div className="flex items-center gap-3">
                    {user.role === 'superadmin' && (
                        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                            <SelectTrigger className="w-48 text-xs">
                                <SelectValue placeholder="All Organizations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Organizations</SelectItem>
                                {organizations.map(org => (
                                    <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {projects.length > 0 && (
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="w-56 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                            <SelectContent>
                                {projects.map(p => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.organization?.name ? `${p.organization.name} - ` : ''}{p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
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
