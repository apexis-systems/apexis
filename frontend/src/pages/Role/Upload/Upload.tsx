"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/projectService';
import { getFolders } from '@/services/folderService';
import { uploadFile } from '@/services/fileService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FileText, Camera, Upload as UploadIcon, Check, Folder } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

type Step = 'project' | 'type' | 'upload' | 'done';

function UploadInner() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlProjectId = searchParams?.get('projectId');
    const urlType = searchParams?.get('type') as 'documents' | 'photos' | null;
    const urlFolderId = searchParams?.get('folderId');

    const [step, setStep] = useState<Step>('project');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [uploadType, setUploadType] = useState<'documents' | 'photos' | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');
    const [projects, setProjects] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (urlProjectId && urlType && urlFolderId) {
            setSelectedProject(urlProjectId); setUploadType(urlType); setSelectedFolder(urlFolderId); setStep('upload');
        } else if (urlProjectId && urlType) {
            setSelectedProject(urlProjectId); setUploadType(urlType); setStep('upload');
        } else if (urlProjectId) {
            setSelectedProject(urlProjectId); setStep('type');
        }
    }, [urlProjectId, urlType, urlFolderId]);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            try {
                const data = await getProjects();
                if (data.projects) setProjects(data.projects);
            } catch (err) {
                console.error("Failed to load projects", err);
            }
        };
        fetchProjects();
    }, [user]);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!selectedProject) {
                setFolders([]);
                return;
            }
            try {
                // Fetch all folders for project, then filter by type locally
                const data = await getFolders(selectedProject);
                if (data.folders) {
                    const typedFolders = data.folders.filter((f: any) => f.type === uploadType);
                    setFolders(typedFolders);
                    if (typedFolders.length > 0 && !selectedFolder) {
                        setSelectedFolder(typedFolders[0].id);
                    }
                }
            } catch (err) {
                console.error("Failed to load folders", err);
            }
        };
        if (selectedProject && uploadType) {
            fetchFolders();
        }
    }, [selectedProject, uploadType]);

    if (!user || user.role === 'client') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground text-sm">Upload is not available for your role.</p>
            </div>
        );
    }

    const dashboardPath = `/${user.role}/dashboard`;
    const filteredProjects = projects.filter((p) => (user.role === 'admin' || user.role === 'superadmin') ? true : true);
    const selectedProjectData = projects.find((p) => p.id === selectedProject);
    const selectedFolderData = folders.find((f) => f.id === selectedFolder);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file to upload');
            return;
        }
        if (!selectedProject) {
            toast.error('Project is required');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('project_id', selectedProject);
            if (selectedFolder) formData.append('folder_id', selectedFolder);

            if (uploadType === 'photos') {
                formData.append('location', photoLocation);
                formData.append('tags', photoTags);
            }

            await uploadFile(formData);
            setStep('done');
            setFile(null);
            toast.success('Files uploaded successfully!');
        } catch (error) {
            console.error('Upload Error', error);
            toast.error('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };
    const goBack = () => {
        if (step === 'project') router.push(dashboardPath);
        else if (step === 'type') setStep('project');
        else if (step === 'upload') setStep('type');
        else router.push(dashboardPath);
    };

    return (
        <div className="max-w-2xl p-8 mx-auto">
            <div className="mb-6 flex items-center gap-2">
                <button onClick={goBack} className="rounded-full p-1.5 hover:bg-secondary transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-bold text-foreground">Upload Files</h1>
            </div>

            {selectedProject && (
                <div className="mb-4 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span>{selectedProjectData?.name}</span>
                    {uploadType && (<><span>›</span><span className="capitalize">{uploadType}</span></>)}
                    {selectedFolder && (<><span>›</span><span>{selectedFolderData?.name}</span></>)}
                </div>
            )}

            {step === 'project' && (
                <div>
                    <p className="text-sm text-muted-foreground mb-4">Select a project</p>
                    <div className="grid grid-cols-4 gap-4">
                        {filteredProjects.map((project) => (
                            <button key={project.id} onClick={() => { setSelectedProject(project.id); setStep('type'); }} className="flex flex-col items-center gap-2 group">
                                <div className="h-14 w-14 rounded-xl flex items-center justify-center shadow-sm border border-border group-hover:border-accent transition-colors" style={{ backgroundColor: project.color || '#f97316' }}>
                                    <span className="text-white text-lg font-bold">{project.name.charAt(0)}</span>
                                </div>
                                <span className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2">{project.name.split(' ').slice(0, 2).join(' ')}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 'type' && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">What are you uploading?</p>
                    <button onClick={() => { setUploadType('documents'); setStep('upload'); }} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left hover:border-accent transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><FileText className="h-5 w-5 text-foreground" /></div>
                        <div><p className="text-sm font-bold">Documents</p><p className="text-xs text-muted-foreground">PDFs, DWG files, drawings</p></div>
                    </button>
                    <button onClick={() => { setUploadType('photos'); setStep('upload'); }} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left hover:border-accent transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><Camera className="h-5 w-5 text-foreground" /></div>
                        <div><p className="text-sm font-bold">Photos</p><p className="text-xs text-muted-foreground">Site photos with metadata</p></div>
                    </button>
                </div>
            )}



            {step === 'upload' && (
                <div className="space-y-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept={uploadType === 'documents' ? ".pdf,.dwg,image/*" : "image/*"}
                    />
                    <div
                        className="flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-card p-8 cursor-pointer hover:border-accent/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadIcon className={`h-10 w-10 mb-3 ${file ? 'text-accent' : 'text-muted-foreground/40'}`} />
                        <p className="text-sm font-medium text-foreground">
                            {file ? file.name : `Click to select ${uploadType === 'documents' ? 'documents' : 'photos'}`}
                        </p>
                        {!file && (
                            <p className="text-xs text-muted-foreground mt-1">{uploadType === 'documents' ? 'PDF, DWG files supported' : 'JPG, PNG files supported'}</p>
                        )}
                    </div>
                    {uploadType === 'photos' && (
                        <>
                            <div className="space-y-1.5"><Label className="text-xs font-medium">Location</Label><Input placeholder="e.g., Block A - Ground Floor" value={photoLocation} onChange={(e) => setPhotoLocation(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label className="text-xs font-medium">Tags</Label><Input placeholder="e.g., foundation, concrete" value={photoTags} onChange={(e) => setPhotoTags(e.target.value)} /></div>
                        </>
                    )}
                    <Button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold disabled:opacity-50"
                    >
                        {isUploading ? 'Uploading...' : 'Upload Files'}
                    </Button>
                </div>
            )}

            {step === 'done' && (
                <div className="flex flex-col items-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4"><Check className="h-8 w-8 text-accent" /></div>
                    <h2 className="text-base font-bold mb-1">Upload Complete</h2>
                    <p className="text-sm text-muted-foreground mb-6">Your files have been uploaded successfully.</p>
                    <Button onClick={() => router.push(dashboardPath)} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Back to Dashboard</Button>
                </div>
            )}
        </div>
    );
}

export default function Upload() {
    return <Suspense><UploadInner /></Suspense>;
}
