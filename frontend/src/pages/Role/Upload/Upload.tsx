"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/projectService';
import { getFolders } from '@/services/folderService';
import { uploadFile } from '@/services/fileService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FileText, Camera, Upload as UploadIcon, Check, Folder, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createActivity } from '@/services/activityService';

type Step = 'project' | 'type' | 'folder' | 'upload' | 'done';

function UploadInner() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlProjectId = searchParams?.get('projectId');
    const urlType = searchParams?.get('type') as 'documents' | 'photos' | null;
    const urlFolderId = searchParams?.get('folderId');
    // Capture the return URL so back/done can go back to exact project page
    const returnUrl = searchParams?.get('returnUrl') || null;

    const [step, setStep] = useState<Step>('project');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>(''); // stored immediately to show in breadcrumb
    const [uploadType, setUploadType] = useState<'documents' | 'photos' | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');
    const [projects, setProjects] = useState<any[]>([]);
    const [allFolders, setAllFolders] = useState<any[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [folderBrowseId, setFolderBrowseId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (urlProjectId && urlType && urlFolderId !== undefined && urlFolderId !== null) {
            setSelectedProject(urlProjectId);
            setUploadType(urlType);
            setSelectedFolder(urlFolderId || null);
            setStep('upload');
        } else if (urlProjectId && urlType) {
            setSelectedProject(urlProjectId);
            setUploadType(urlType);
            setStep('folder');
        } else if (urlProjectId) {
            setSelectedProject(urlProjectId);
            setStep('type');
        }
    }, [urlProjectId, urlType, urlFolderId]);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            try {
                const data = await getProjects();
                if (data.projects) {
                    setProjects(data.projects);
                    // Once loaded, update projectName if not already set
                    if (selectedProject && !projectName) {
                        const found = data.projects.find((p: any) => String(p.id) === String(selectedProject));
                        if (found) setProjectName(found.name);
                    }
                }
            } catch (err) {
                console.error("Failed to load projects", err);
            }
        };
        fetchProjects();
    }, [user]);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!selectedProject || !uploadType) { setAllFolders([]); return; }
            try {
                const data = await getFolders(selectedProject);
                // Backend returns a plain array OR {folders: [...]}
                const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
                // Filter by type client-side (documents vs photos)
                setAllFolders(rawFolders.filter((f: any) => !f.type || f.type === uploadType));
            } catch (err) {
                console.error("Failed to load folders", err);
            }
        };
        if (selectedProject && uploadType) fetchFolders();
    }, [selectedProject, uploadType]);

    if (!user || user.role === 'client') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground text-sm">Upload is not available for your role.</p>
            </div>
        );
    }

    const dashboardPath = returnUrl || `/${user.role}/dashboard`;
    const selectedProjectData = projects.find((p) => String(p.id) === String(selectedProject));
    // Use project name from state (set when project clicked) or from the async-loaded selectedProjectData
    const displayProjectName = projectName || selectedProjectData?.name || '';

    // Build nested folder tree helpers — use String() to handle number vs string IDs
    const getFolderChildren = (parentId: string | null) =>
        allFolders.filter((f) => String(f.parent_id ?? 'null') === String(parentId ?? 'null'));

    const getBreadcrumbFolders = (folderId: string | null): any[] => {
        if (!folderId) return [];
        const current = allFolders.find((f) => String(f.id) === String(folderId));
        if (!current) return [];
        return [...getBreadcrumbFolders(current.parent_id != null ? String(current.parent_id) : null), current];
    };

    const currentBrowseFolders = getFolderChildren(folderBrowseId);
    const browseBreadcrumbs = getBreadcrumbFolders(folderBrowseId);
    const selectedFolderData = allFolders.find((f) => String(f.id) === String(selectedFolder));
    // Full path breadcrumb for the selected folder (e.g. folder1 › test › hello)
    const selectedFolderPath = getBreadcrumbFolders(selectedFolder);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            if (files.length + selectedFiles.length > 20) {
                toast.error('You can only upload up to 20 files at once.');
                return;
            }
            setFiles(prev => [...prev, ...selectedFiles].slice(0, 20));
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) { toast.error('Please select at least one file to upload'); return; }
        if (!selectedProject) { toast.error('Project is required'); return; }

        setIsUploading(true);
        try {
            await Promise.all(files.map(async (f) => {
                const formData = new FormData();
                formData.append('file', f);
                formData.append('project_id', selectedProject);
                formData.append('skipActivity', 'true');
                if (selectedFolder) formData.append('folder_id', selectedFolder);
                if (uploadType === 'photos') {
                    formData.append('location', photoLocation);
                    formData.append('tags', photoTags);
                }
                return uploadFile(formData);
            }));

            // Group Activity log
            await createActivity({
                project_id: selectedProject,
                type: uploadType === 'photos' ? 'upload_photo' : 'upload',
                description: `${files.length} new ${uploadType === 'documents' ? 'documents' : 'site photos'} added`
            });

            setStep('done');
            setFiles([]);
            toast.success('Files uploaded successfully!');
        } catch (error) {
            console.error('Upload Error', error);
            toast.error('Failed to upload files');
        } finally {
            setIsUploading(false);
        }
    };

    const goBack = () => {
        if (step === 'project') router.push(dashboardPath);
        else if (step === 'type') {
            if (urlProjectId) router.push(dashboardPath);
            else setStep('project');
        }
        else if (step === 'folder') {
            if (urlProjectId && urlType) router.push(dashboardPath);
            else setStep('type');
        }
        else if (step === 'upload') {
            if (urlProjectId && urlType && urlFolderId !== undefined) router.push(dashboardPath);
            else setStep('folder');
        }
        else router.push(dashboardPath);
    };

    // Upload Again — keep all context (project, type, folder) and go back to upload step
    const uploadAgain = () => {
        setFiles([]);
        setStep('upload');
    };

    return (
        <div className="max-w-2xl p-8 mx-auto">
            <div className="mb-6 flex items-center gap-2">
                <button onClick={goBack} className="rounded-full p-1.5 hover:bg-secondary transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-bold text-foreground">Upload Files</h1>
            </div>

            {/* Breadcrumb — only show on upload/done steps to avoid duplicate with folder step's own breadcrumb */}
            {selectedProject && (step === 'upload' || step === 'done') && (
                <div className="mb-4 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-foreground">{displayProjectName}</span>
                    {uploadType && (<><span>›</span><span className="capitalize">{uploadType}</span></>)}
                    {selectedFolder && selectedFolderPath.length > 0 && (
                        selectedFolderPath.map((f, i) => (
                            <span key={f.id} className="flex items-center gap-1">
                                <span>›</span>
                                <span>{f.name}</span>
                            </span>
                        ))
                    )}
                </div>
            )}

            {step === 'project' && (
                <div>
                    <p className="text-sm text-muted-foreground mb-4">Select a project</p>
                    <div className="grid grid-cols-4 gap-4">
                        {projects.map((project) => (
                            <button key={project.id} onClick={() => { setSelectedProject(project.id); setProjectName(project.name); setStep('type'); }} className="flex flex-col items-center gap-2 group">
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
                    <button onClick={() => { setUploadType('documents'); setFolderBrowseId(null); setStep('folder'); }} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left hover:border-accent transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><FileText className="h-5 w-5 text-foreground" /></div>
                        <div><p className="text-sm font-bold">Documents</p><p className="text-xs text-muted-foreground">PDFs, DWG files, drawings</p></div>
                    </button>
                    <button onClick={() => { setUploadType('photos'); setFolderBrowseId(null); setStep('folder'); }} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left hover:border-accent transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><Camera className="h-5 w-5 text-foreground" /></div>
                        <div><p className="text-sm font-bold">Photos</p><p className="text-xs text-muted-foreground">Site photos with metadata</p></div>
                    </button>
                </div>
            )}

            {step === 'folder' && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Select destination folder</p>

                    {/* Folder breadcrumb navigation */}
                    <div className="flex items-center gap-1 flex-wrap text-xs">
                        <button
                            onClick={() => setFolderBrowseId(null)}
                            className={`font-medium ${!folderBrowseId ? 'text-accent' : 'text-muted-foreground hover:underline'}`}
                        >
                            {selectedProjectData?.name || 'Project root'}
                        </button>
                        {browseBreadcrumbs.map((b) => (
                            <span key={b.id} className="flex items-center gap-1">
                                <span className="text-muted-foreground">/</span>
                                <button
                                    onClick={() => setFolderBrowseId(b.id)}
                                    className={`font-medium ${folderBrowseId === b.id ? 'text-accent' : 'text-muted-foreground hover:underline'}`}
                                >
                                    {b.name}
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        {/* Root level option (only at root browse) */}
                        {!folderBrowseId && (
                            <button
                                onClick={() => { setSelectedFolder(null); setStep('upload'); }}
                                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${!selectedFolder ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'}`}
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                    <Folder className="h-4 w-4 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Root Level</p>
                                    <p className="text-xs text-muted-foreground">Upload directly to project</p>
                                </div>
                            </button>
                        )}

                        {/* Children of current browsed folder */}
                        {currentBrowseFolders.map((folder) => {
                            const hasChildren = allFolders.some((f) => f.parent_id === folder.id);
                            return (
                                <div key={folder.id} className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setSelectedFolder(folder.id); setStep('upload'); }}
                                        className={`flex-1 flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selectedFolder === folder.id ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'}`}
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                            <Folder className="h-4 w-4 text-accent" />
                                        </div>
                                        <p className="text-sm font-medium flex-1">{folder.name}</p>
                                    </button>
                                    {hasChildren && (
                                        <button
                                            onClick={() => setFolderBrowseId(folder.id)}
                                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-xs text-muted-foreground flex-shrink-0"
                                            title="Browse subfolders"
                                        >
                                            <ArrowLeft className="h-4 w-4 rotate-180" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {currentBrowseFolders.length === 0 && folderBrowseId && (
                            <p className="text-xs text-muted-foreground text-center py-4">No subfolders here. Select this folder or go back.</p>
                        )}
                        {allFolders.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No folders found. You can upload to Root Level.</p>
                        )}
                    </div>

                    {/* Upload to current browse level */}
                    {folderBrowseId && (
                        <Button
                            variant="outline"
                            onClick={() => { setSelectedFolder(folderBrowseId); setStep('upload'); }}
                            className="w-full text-xs"
                        >
                            Upload to "{browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name}"
                        </Button>
                    )}
                </div>
            )}

            {step === 'upload' && (
                <div className="space-y-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        onChange={handleFileChange}
                        accept={uploadType === 'documents' ? ".pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt" : "image/*"}
                    />
                    <div
                        className="flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-card p-8 cursor-pointer hover:border-accent/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadIcon className={`h-10 w-10 mb-3 ${files.length > 0 ? 'text-accent' : 'text-muted-foreground/40'}`} />
                        <p className="text-sm font-medium text-foreground">
                            {files.length > 0 ? `${files.length} file(s) selected` : `Click to select ${uploadType === 'documents' ? 'documents' : 'photos'} (Max 20)`}
                        </p>
                        {files.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{uploadType === 'documents' ? 'PDF, DWG files supported' : 'JPG, PNG files supported'}</p>
                        )}
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center justify-between bg-card border border-border rounded-lg p-2 px-3">
                                    <span className="text-xs truncate w-5/6">{f.name}</span>
                                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-secondary rounded-full">
                                        <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {uploadType === 'photos' && (
                        <>
                            <div className="space-y-1.5"><Label className="text-xs font-medium">Location</Label><Input placeholder="e.g., Block A - Ground Floor" value={photoLocation} onChange={(e) => setPhotoLocation(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label className="text-xs font-medium">Tags</Label><Input placeholder="e.g., foundation, concrete" value={photoTags} onChange={(e) => setPhotoTags(e.target.value)} /></div>
                        </>
                    )}
                    <Button
                        onClick={handleUpload}
                        disabled={files.length === 0 || isUploading}
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
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <Button
                            onClick={uploadAgain}
                            className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                            Upload Again
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(dashboardPath)}
                            className="w-full rounded-xl"
                        >
                            {returnUrl ? 'Go Back to Folder' : 'Back to Dashboard'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Upload() {
    return <Suspense><UploadInner /></Suspense>;
}
