"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/projectService';
import { getFolders, createFolder } from '@/services/folderService';
import { uploadFile } from '@/services/fileService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload as UploadIcon, Check, Folder, X, ChevronRight, ChevronDown, MapPin, Tag, Camera } from 'lucide-react';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createActivity } from '@/services/activityService';
import CreateFolderDialog from '../Project/ProjectDetails/CreateFolderDialog';
import { getApiErrorMessage } from '@/helpers/apiError';

function UploadInner() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlProjectId = searchParams?.get('projectId');
    const urlType = searchParams?.get('type') as 'documents' | 'photos' | null;
    const urlFolderId = searchParams?.get('folderId');
    // returnUrl used to go back to the exact project folder page after upload
    const returnUrl = searchParams?.get('returnUrl') || null;

    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>('');
    const [uploadType, setUploadType] = useState<'documents' | 'photos' | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');
    const [projects, setProjects] = useState<any[]>([]);
    const [allFolders, setAllFolders] = useState<any[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [folderBrowseId, setFolderBrowseId] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [doneType, setDoneType] = useState<'documents' | 'photos'>('documents');

    // Section collapsed state
    const [metaOpen, setMetaOpen] = useState(false);
    const [projectOpen, setProjectOpen] = useState(!urlProjectId);
    const [folderOpen, setFolderOpen] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [filePreviews, setFilePreviews] = useState<(string | null)[]>([]);
    const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);

    const dataUrlToBlob = (dataUrl: string) => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
    };

    const handleAnnotateSave = (annotatedDataUrl: string) => {
        if (annotatingIdx === null) return;
        const blob = dataUrlToBlob(annotatedDataUrl);
        const fileName = files[annotatingIdx]?.name || `annotated_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        setFiles(prev => { const copy = [...prev]; copy[annotatingIdx] = file; return copy; });
        setFilePreviews(prev => { const copy = [...prev]; copy[annotatingIdx] = annotatedDataUrl; return copy; });
        setAnnotatingIdx(null);
    };

    // Prefill from URL params (navigated from project folder)
    useEffect(() => {
        if (urlProjectId) {
            setSelectedProject(urlProjectId);
            setProjectOpen(false);
            setFolderOpen(false);
        }
        if (urlType) setUploadType(urlType);
        if (urlFolderId) {
            setSelectedFolder(urlFolderId);
        }
    }, [urlProjectId, urlType, urlFolderId]);

    // Auto-open folder section when a project is manually selected
    useEffect(() => {
        if (selectedProject && !urlProjectId) setFolderOpen(true);
    }, [selectedProject, urlProjectId]);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            try {
                const data = await getProjects();
                if (data.projects) {
                    setProjects(data.projects);
                    if (urlProjectId && !projectName) {
                        const found = data.projects.find((p: any) => String(p.id) === String(urlProjectId));
                        if (found) setProjectName(found.name);
                    }
                }
            } catch (err) { console.error("Failed to load projects", err); }
        };
        fetchProjects();
    }, [user]);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!selectedProject) { setAllFolders([]); return; }
            try {
                const typeMap: any = { photos: 'photo', documents: 'document' };
                const data = await getFolders(selectedProject, uploadType ? typeMap[uploadType] : undefined);
                const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
                setAllFolders(rawFolders);
            } catch (err) { console.error("Failed to load folders", err); }
        };
        if (selectedProject) fetchFolders();
    }, [selectedProject, uploadType]);

    const importFolders = async () => {
        if (!selectedProject) return;
        try {
            const typeMap: any = { photos: 'photo', documents: 'document' };
            const data = await getFolders(selectedProject, uploadType ? typeMap[uploadType] : undefined);
            const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
            setAllFolders(rawFolders);
        } catch (err) { console.error("Failed to reload folders", err); }
    };

    if (!user || user.role === 'client') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground text-sm">Upload is not available for your role.</p>
            </div>
        );
    }

    // After upload, go to the returnUrl (the folder page we came from) or build one
    const dashboardPath = returnUrl || `/${user.role}/dashboard`;
    const selectedProjectData = projects.find((p) => String(p.id) === String(selectedProject));
    const displayProjectName = projectName || selectedProjectData?.name || '';

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
    const selectedFolderPath = getBreadcrumbFolders(selectedFolder);

    const isPhotos = uploadType === 'photos';

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            if (files.length + selectedFiles.length > 20) {
                toast.error('You can only upload up to 20 files at once.');
                return;
            }
            const newFiles = [...files, ...selectedFiles].slice(0, 20);
            setFiles(newFiles);
            // Auto-detect upload type from file MIME types
            const allImages = newFiles.every(f => f.type.startsWith('image/'));
            if (!urlType) {
                const detectedType = allImages ? 'photos' : 'documents';
                setUploadType(detectedType);
                if (detectedType === 'photos') setMetaOpen(true);
                else setMetaOpen(false);
            }
            // Generate previews for image files
            selectedFiles.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = () => setFilePreviews(prev => [...prev, reader.result as string]);
                    reader.readAsDataURL(file);
                } else {
                    setFilePreviews(prev => [...prev, null]);
                }
            });
        }
    };

    const handleCreateFolder = async (name: string) => {
        if (!selectedProject) return;
        try {
            const typeMap: any = { photos: 'photo', documents: 'document' };
            const res = await createFolder({
                project_id: selectedProject,
                name,
                parent_id: folderBrowseId,
                folder_type: uploadType ? typeMap[uploadType] : null
            });
            toast.success(`Folder "${name}" created`);
            await importFolders();
            if (res.folder) {
                setSelectedFolder(String(res.folder.id));
                setFolderOpen(false);
            }
        } catch (e) {
            toast.error("Failed to create folder");
        }
    };

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        setFilePreviews(prev => prev.filter((_, i) => i !== index));
        if (newFiles.length > 0 && !urlType) {
            const allImages = newFiles.every(f => f.type.startsWith('image/'));
            setUploadType(allImages ? 'photos' : 'documents');
        } else if (newFiles.length === 0 && !urlType) {
            setUploadType(null);
            setMetaOpen(false);
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) { toast.error('Please select at least one file to upload'); return; }
        if (!selectedProject) { toast.error('Please select a project'); return; }
        const effectiveType = uploadType || (files.every(f => f.type.startsWith('image/')) ? 'photos' : 'documents');

        setIsUploading(true);
        try {
            await Promise.all(files.map(async (f) => {
                const formData = new FormData();
                formData.append('file', f);
                formData.append('project_id', selectedProject);
                formData.append('skipActivity', 'true');
                if (selectedFolder) formData.append('folder_id', selectedFolder);
                if (effectiveType === 'photos') {
                    if (photoLocation) formData.append('location', photoLocation);
                    if (photoTags) formData.append('tags', photoTags);
                }
                return uploadFile(formData);
            }));

            await createActivity({
                project_id: selectedProject,
                type: effectiveType === 'photos' ? 'upload_photo' : 'upload',
                description: `${files.length} new ${effectiveType === 'documents' ? 'documents' : 'site photos'} added`
            });

            let projectUrl: string;
            if (returnUrl) {
                projectUrl = returnUrl;
            } else {
                const tab = effectiveType === 'photos' ? 'photos' : 'documents';
                const folderParam = selectedFolder ? `&folder=${selectedFolder}` : '';
                projectUrl = `/${user.role}/project/${selectedProject}?tab=${tab}${folderParam}`;
            }

            setDoneType(effectiveType);
            setDone(true);
            setFiles([]);
            toast.success('Files uploaded successfully!');
        } catch (error) {
            console.error('Upload Error', error);
            toast.error(getApiErrorMessage(error, 'Failed to upload files'));
        } finally {
            setIsUploading(false);
        }
    };

    if (done) {
        // Build the go-to URL from selected state
        const tab = doneType === 'photos' ? 'photos' : 'documents';
        const folderParam = selectedFolder ? `&folder=${selectedFolder}` : '';
        const goToUrl = returnUrl
            ? returnUrl
            : selectedProject
                ? `/${user.role}/project/${selectedProject}?tab=${tab}${folderParam}`
                : dashboardPath;

        return (
            <div className="max-w-md mx-auto p-8 flex flex-col items-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                    <Check className="h-8 w-8 text-accent" />
                </div>
                <h2 className="text-base font-bold mb-1">Upload Complete</h2>
                <p className="text-sm text-muted-foreground mb-6">Your files were uploaded successfully.</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Button onClick={() => { setDone(false); setFiles([]); setUploadType(urlType); setMetaOpen(false); }} className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                        Upload Again
                    </Button>
                    <Button variant="outline" onClick={() => router.push(goToUrl)} className="w-full rounded-xl">
                        Return to Folder
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl p-6 mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <button onClick={() => router.push(dashboardPath)} className="rounded-full p-1.5 hover:bg-secondary transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-bold text-foreground">Upload Files</h1>
            </div>

            {/* ── Section 1: File Picker ── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">1. Select files</p>
                </div>
                <div className="p-4 space-y-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        onChange={handleFileChange}
                        accept={isPhotos ? "image/*" : uploadType === 'documents' ? ".pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt" : undefined}
                    />
                    <div
                        className="flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/30 p-6 cursor-pointer hover:border-accent/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadIcon className={`h-8 w-8 mb-2 ${files.length > 0 ? 'text-accent' : 'text-muted-foreground/40'}`} />
                        <p className="text-sm font-medium text-foreground">
                            {files.length > 0 ? `${files.length} file(s) selected — click to add more` : 'Click to select files (Max 20)'}
                        </p>
                        {files.length === 0 && <p className="text-xs text-muted-foreground mt-1">Documents, images, PDFs — type auto-detected</p>}
                        {files.length > 0 && uploadType && (
                            <p className="text-xs text-accent mt-1">Detected as: {uploadType === 'photos' ? '📷 Photos' : '📄 Documents'}</p>
                        )}
                    </div>
                    {files.length > 0 && (
                        isPhotos ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {files.map((f, i) => (
                                    <div key={f.name + i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                                        {filePreviews[i] ? (
                                            <img src={filePreviews[i]!} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                                                <Camera className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            {filePreviews[i] && (
                                                <button onClick={() => setAnnotatingIdx(i)} className="bg-accent p-1.5 rounded-full hover:scale-110 transition-transform">
                                                    <Camera className="h-3 w-3 text-white" />
                                                </button>
                                            )}
                                            <button onClick={() => removeFile(i)} className="bg-destructive p-1.5 rounded-full hover:scale-110 transition-transform">
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                {files.map((f, i) => (
                                    <div key={f.name + i} className="flex items-center justify-between bg-secondary/50 rounded-lg p-2 px-3">
                                        <span className="text-xs truncate w-5/6 text-foreground">{f.name}</span>
                                        <button onClick={() => removeFile(i)} className="p-1 hover:bg-secondary rounded-full flex-shrink-0">
                                            <X className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* ── Section 2: Location & Tags (photos only) ── */}
            {isPhotos && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors"
                        onClick={() => setMetaOpen(p => !p)}
                    >
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">2. Location &amp; Tags</p>
                            <span className="text-xs text-muted-foreground">(optional)</span>
                            {(photoLocation || photoTags) && (
                                <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">filled</span>
                            )}
                        </div>
                        {metaOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {metaOpen && (
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <Label className="text-xs font-medium">Location</Label>
                            </div>
                            <Input placeholder="e.g., Block A - Ground Floor" value={photoLocation} onChange={(e) => setPhotoLocation(e.target.value)} />
                            <div className="flex items-center gap-2 mt-2">
                                <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <Label className="text-xs font-medium">Tags</Label>
                            </div>
                            <Input placeholder="e.g., foundation, concrete" value={photoTags} onChange={(e) => setPhotoTags(e.target.value)} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Section 3: Project & Folder ── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors"
                    onClick={() => setProjectOpen(p => !p)}
                >
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{isPhotos ? '3.' : '2.'} Project &amp; Folder</p>
                        {selectedProject && (
                            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                                {displayProjectName}{selectedFolderData ? ` › ${selectedFolderData.name}` : ''}
                            </span>
                        )}
                    </div>
                    {projectOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {projectOpen && (
                    <div className="p-4 space-y-4">
                        {/* Project grid */}
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Select project</p>
                            <div className="grid grid-cols-4 gap-3">
                                {projects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => {
                                            setSelectedProject(String(project.id));
                                            setProjectName(project.name);
                                            setSelectedFolder(null);
                                            setFolderBrowseId(null);
                                            setFolderOpen(true);
                                        }}
                                        className="flex flex-col items-center gap-1.5 group"
                                    >
                                        <div
                                            className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm border-2 transition-all ${String(selectedProject) === String(project.id) ? 'border-accent scale-105' : 'border-transparent group-hover:border-accent/50'}`}
                                            style={{ backgroundColor: project.color || 'hsl(var(--accent))' }}

                                        >
                                            <span className="text-white text-base font-bold">{project.name.charAt(0)}</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-foreground text-center line-clamp-1">{project.name.split(' ').slice(0, 2).join(' ')}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Folder selector (shown after a project is selected) */}
                        {selectedProject && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">Destination folder</p>
                                        <button
                                            onClick={() => setShowCreateFolder(true)}
                                            className="flex items-center gap-1 text-[10px] text-accent font-semibold hover:underline"
                                        >
                                            + New Folder
                                        </button>
                                    </div>
                                    <button
                                        className="text-[10px] text-muted-foreground hover:underline"
                                        onClick={() => setFolderOpen(p => !p)}
                                    >
                                        {folderOpen ? 'Collapse ▲' : 'Expand ▼'}
                                    </button>
                                </div>

                                {/* Folder breadcrumb nav */}
                                {folderOpen && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1 flex-wrap text-xs">
                                            <button
                                                onClick={() => setFolderBrowseId(null)}
                                                className={`font-medium ${!folderBrowseId ? 'text-accent' : 'text-muted-foreground hover:underline'}`}
                                            >
                                                {displayProjectName || 'Project'}
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

                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {/* Root level */}
                                            {!folderBrowseId && (
                                                <button
                                                    onClick={() => { setSelectedFolder(null); setFolderOpen(false); }}
                                                    className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${!selectedFolder ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'}`}
                                                >
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                                        <Folder className="h-3.5 w-3.5 text-accent" />
                                                    </div>
                                                    <p className="text-xs font-medium">{displayProjectName}</p>
                                                </button>
                                            )}
                                            {/* Folder list */}
                                            {currentBrowseFolders.map((folder) => {
                                                const hasChildren = allFolders.some((f) => String(f.parent_id) === String(folder.id));
                                                return (
                                                    <div key={folder.id} className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => { setSelectedFolder(folder.id); setFolderOpen(false); }}
                                                            className={`flex-1 flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${String(selectedFolder) === String(folder.id) ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'}`}
                                                        >
                                                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                                                <Folder className="h-3.5 w-3.5 text-accent" />
                                                            </div>
                                                            <p className="text-xs font-medium flex-1">{folder.name}</p>
                                                        </button>
                                                        {hasChildren && (
                                                            <button
                                                                onClick={() => setFolderBrowseId(folder.id)}
                                                                className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                                                                title="Browse subfolders"
                                                            >
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {allFolders.length === 0 && (
                                                <p className="text-xs text-muted-foreground text-center py-3">No folders yet. Please create a folder to upload.</p>
                                            )}
                                        </div>

                                        {folderBrowseId && (
                                            <button
                                                onClick={() => { setSelectedFolder(folderBrowseId); setFolderOpen(false); }}
                                                className="w-full text-xs text-accent font-medium py-1 hover:underline text-left"
                                            >
                                                → Use &quot;{browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name}&quot; as destination
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Current selection pill (when collapsed) */}
                                {!folderOpen && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Folder className="h-3.5 w-3.5 text-accent" />
                                        {selectedFolderData
                                            ? <span className="font-medium text-foreground">{selectedFolderPath.map(f => f.name).join(' › ')}</span>
                                            : <span className="text-red-500 font-medium">Please select a folder</span>
                                        }
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedProject && (
                            <button className="text-xs text-accent font-medium" onClick={() => setProjectOpen(false)}>
                                Done →
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Summary breadcrumb ── */}
            {selectedProject && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-foreground">{displayProjectName}</span>
                    {selectedFolderPath.map((f) => (
                        <span key={f.id} className="flex items-center gap-1">
                            <span>›</span>
                            <span>{f.name}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* ── Upload button ── */}
            <Button
                onClick={handleUpload}
                disabled={files.length === 0 || !selectedProject || !selectedFolder || isUploading}
                className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold disabled:opacity-50"
            >
                {isUploading ? 'Uploading...' : !selectedFolder ? 'Select a folder' : `Upload ${files.length > 0 ? files.length + ' file(s)' : 'Files'}`}
            </Button>

            <CreateFolderDialog
                open={showCreateFolder}
                onOpenChange={setShowCreateFolder}
                onCreateFolder={handleCreateFolder}
                type={uploadType || 'documents'}
            />

            {annotatingIdx !== null && filePreviews[annotatingIdx] && (
                <ImageAnnotator
                    imageSrc={filePreviews[annotatingIdx]!}
                    onSave={handleAnnotateSave}
                    onCancel={() => setAnnotatingIdx(null)}
                />
            )}
        </div>
    );
}

export default function Upload() {
    return <Suspense><UploadInner /></Suspense>;
}
