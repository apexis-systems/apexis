"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileText, Camera, Clock, Loader2 } from 'lucide-react';
import { getProjects } from '@/services/projectService';
import { getFiles } from '@/services/fileService';

interface ActivityItem {
    id: string;
    type: 'upload_doc' | 'upload_photo';
    description: string;
    projectName: string;
    timestamp: string;
    rawDate: Date;
}

const Activity = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            try {
                // 1. Get user's projects
                const pRes = await getProjects();
                const projects = pRes.projects || [];

                // 2. Fetch files for all these projects in parallel
                const feed: ActivityItem[] = [];

                await Promise.all(projects.map(async (p: any) => {
                    try {
                        const fRes = await getFiles(p.id);
                        const folders = fRes.folderData || [];

                        folders.forEach((folder: any) => {
                            if (!folder.files) return;
                            folder.files.forEach((file: any) => {
                                const isPhoto = file.file_type?.startsWith('image/');
                                feed.push({
                                    id: `f-${file.id}`,
                                    type: isPhoto ? 'upload_photo' : 'upload_doc',
                                    description: `Uploaded ${file.file_name}`,
                                    projectName: p.name,
                                    timestamp: new Date(file.createdAt).toLocaleString('en-IN', {
                                        dateStyle: 'medium', timeStyle: 'short'
                                    }),
                                    rawDate: new Date(file.createdAt)
                                });
                            });
                        });
                    } catch (e) {
                        console.error(`Failed files for project ${p.id}`, e);
                    }
                }));

                // 3. Sort newest first
                feed.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
                setActivities(feed);
            } catch (error) {
                console.error("Activity load error", error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    if (!user) return null;

    return (
        <div className="max-w-4xl p-8 mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground">{t('activity')}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Updates from your projects</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : (
                <div className="space-y-2">
                    {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 rounded-xl bg-card border border-border p-3.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${activity.type === 'upload_photo' ? 'bg-blue-500/10' : 'bg-accent/10'} shrink-0`}>
                                {activity.type === 'upload_photo' ? <Camera className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-accent" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{activity.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{activity.projectName}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{activity.timestamp}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && activities.length === 0 && (
                <div className="mt-12 text-center">
                    <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-xs text-muted-foreground">No recent activity</p>
                </div>
            )}
        </div>
    );
};

export default Activity;
