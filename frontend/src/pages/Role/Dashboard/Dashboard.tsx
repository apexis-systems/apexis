"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsage } from '@/contexts/UsageContext';
import { FileText, Camera, MapPin, CalendarDays, ArrowRight, Plus, Loader2, X, Copy, Check, ChevronDown, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { getProjects, createProject } from '@/services/projectService';
import { getOrgOverview, uploadOrgLogo, getSecureFileUrl, getOrganizations } from '@/services/superadminService';
import { toast } from 'sonner';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getApiErrorMessage } from '@/helpers/apiError';

export default function Dashboard() {
    const auth = useAuth() || {};
    const user = auth.user;
    const router = useRouter();
    const { t } = useLanguage();
    const { checkLimit } = useUsage();

    const [projects, setProjects] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', description: '', start_date: '', end_date: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [orgData, setOrgData] = useState<any>(null);
    const [localLogo, setLocalLogo] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [sortType, setSortType] = useState<'name' | 'newest' | 'oldest'>('name');
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Cropping states
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (user) {
            if (user.role === 'superadmin') {
                fetchOrgOverview();
                fetchOrganizations();
            }
            fetchProjects(selectedOrgId);
            const typedUser = user as any;
            if (typedUser.organization?.logo) {
                setLocalLogo(typedUser.organization.logo);
            }
        }
    }, [user, selectedOrgId, sortType]);

    useEffect(() => {
        let currentUrl: string | null = null;
        const fetchLogo = async () => {
            if (localLogo) {
                const url = await getSecureFileUrl(localLogo);
                if (url) {
                    setLogoUrl(url);
                    currentUrl = url;
                }
            }
        };
        fetchLogo();
        return () => {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
    }, [localLogo]);

    const fetchOrgOverview = async () => {
        try {
            const data = await getOrgOverview();
            setOrgData(data);
            if (data.organization?.logo) setLocalLogo(data.organization.logo);
        } catch (e) {
            console.error("Failed to fetch org overview", e);
        }
    };

    const fetchOrganizations = async () => {
        try {
            const data = await getOrganizations();
            setOrganizations(data || []);
        } catch (e) {
            console.error("Failed to fetch organizations", e);
        }
    };

    const fetchProjects = async (orgId?: string) => {
        try {
            const data = await getProjects(orgId);
            let sortedProjects = data.projects || [];
            if (sortType === 'newest') {
                sortedProjects.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            } else if (sortType === 'oldest') {
                sortedProjects.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            } else {
                sortedProjects.sort((a: any, b: any) => 
                    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                );
            }
            setProjects([...sortedProjects]);
        } catch (e) {
            console.error("Failed to fetch projects", e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!checkLimit('projects')) {
            toast.error("Limit Reached: You have reached your project limit. Please upgrade your plan to create more projects.", {
                action: {
                    label: 'Upgrade',
                    onClick: () => router.push(`/${user?.role || 'admin'}/billing`)
                },
                duration: 5000,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await createProject(newProject);
            setIsCreating(false);
            setNewProject({ name: '', description: '', start_date: '', end_date: '' });
            fetchProjects();
            toast.success('Project created successfully');
        } catch (e: any) {
            console.error("Failed to create project", e);
            toast.error(getApiErrorMessage(e, 'Failed to create project'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (user?.role !== 'admin') return;
        const file = e.target.files?.[0];
        if (!file) return;

        setCrop(undefined); // Reset crop
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImgSrc(reader.result?.toString() || '');
            setIsCropModalOpen(true);
        });
        reader.readAsDataURL(file);
    };

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const _crop = makeAspectCrop(
            { unit: '%', width: 90 },
            1, // 1:1 aspect ratio
            width,
            height
        );
        setCrop(centerCrop(_crop, width, height));
    }

    const handleUploadCropped = async () => {
        if (!completedCrop || !imgRef.current) return;

        setIsUploadingLogo(true);
        setIsCropModalOpen(false);

        try {
            // Create canvas to draw the cropped image
            const canvas = document.createElement('canvas');
            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
            canvas.width = completedCrop.width;
            canvas.height = completedCrop.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('No 2d context');

            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                imgRef.current,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0,
                0,
                completedCrop.width,
                completedCrop.height
            );

            // Convert to blob and upload
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (!blob) throw new Error('Canvas is empty');

            const formData = new FormData();
            formData.append('logo', blob, 'logo.jpg');

            const res = await uploadOrgLogo(formData);
            setLocalLogo(res.logo);
            toast.success('Organization logo updated');
        } catch (error) {
            console.error("Logo upload failed", error);
            toast.error('Failed to upload logo');
        } finally {
            setIsUploadingLogo(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success('Copied to clipboard');
    };

    if (!user) {
        return (
            <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Please log in to view the dashboard.</p>
            </div>
        );
    }

    const totalDocs = projects.reduce((sum, p) => sum + (parseInt(p.totalDocs, 10) || 0), 0);
    const totalPhotos = projects.reduce((sum, p) => sum + (parseInt(p.totalPhotos, 10) || 0), 0);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Hidden Log Input */}
            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />

            {/* Greeting with Logo */}
            <div className="mb-8 flex items-center gap-4">
                <div
                    className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setIsPreviewOpen(true)}
                >
                    {isUploadingLogo ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : logoUrl || (user.role === 'superadmin' ? '/app-icon.png' : null) ? (
                        <img src={logoUrl || '/app-icon.png'} alt="Org Logo" className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-[10px] text-muted-foreground font-medium">Logo</span>
                    )}
                    {user.role === 'admin' && !isUploadingLogo && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Camera className="h-4 w-4 text-white" />
                        </div>
                    )}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {t('welcome_back')}, {user.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {(user.role === 'admin' || user.role === 'superadmin') && t('manage_projects')}
                        {user.role === 'contributor' && t('assigned_projects')}
                        {user.role === 'client' && t('shared_projects')}
                    </p>
                </div>
            </div>

            {(user.role === 'admin' || user.role === 'superadmin') && (
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {user.role === 'superadmin' && orgData && (
                        <>
                            <div className="rounded-xl bg-card border border-border p-5">
                                <div className="text-sm text-muted-foreground">{t('org_users')}</div>
                                <div className="mt-1 text-3xl font-bold text-foreground">{orgData.users?.length || 0}</div>
                            </div>
                            <div className="rounded-xl bg-card border border-border p-5">
                                <div className="text-sm text-muted-foreground">{t('all_projects')}</div>
                                <div className="mt-1 text-3xl font-bold text-foreground">{orgData.projects?.length || 0}</div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">{t('total_projects')}</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{projects.length}</div>
                </div>
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">{t('documents')}</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{totalDocs}</div>
                </div>
                <div className="rounded-xl bg-card border border-border p-5">
                    <div className="text-sm text-muted-foreground">{t('photos')}</div>
                    <div className="mt-1 text-3xl font-bold text-foreground">{totalPhotos}</div>
                </div>
            </div>

            <div id="projects-list-header" className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-6">
                    <h2 className="text-lg font-bold text-foreground">
                        {user.role === 'superadmin' ? t('organization_projects') : t('your_projects')}
                    </h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-semibold gap-1.5 text-muted-foreground bg-secondary/50">
                                Sort by: <span className="text-foreground capitalize">{sortType === 'name' ? 'Name' : sortType}</span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel className="text-[10px]">Sort Projects By</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSortType('name')} className="text-xs flex items-center justify-between">
                                Name {sortType === 'name' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortType('newest')} className="text-xs flex items-center justify-between">
                                Newest {sortType === 'newest' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortType('oldest')} className="text-xs flex items-center justify-between">
                                Oldest {sortType === 'oldest' && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-3">
                    {user.role === 'superadmin' && (
                        <select
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                            <option value="">{t('all_organizations')}</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    )}
                    {user.role === 'admin' && (
                        <button
                            onClick={() => setIsCreating(!isCreating)}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="h-4 w-4" /> {t('create_project')}
                        </button>
                    )}
                </div>
            </div>

            {isCreating && (
                <div className="rounded-xl bg-card border border-border p-6 mb-8">
                    <h3 className="text-lg font-bold text-foreground mb-4">Create New Project</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Project Name (max 25)</label>
                            <input
                                required
                                type="text"
                                maxLength={25}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                                value={newProject.name}
                                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Company Name/Client Name (max 50)</label>
                            <input
                                type="text"
                                maxLength={50}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border/80"
                                placeholder="Enter Company/Client Name"
                                value={newProject.description}
                                onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
                            <input
                                required
                                type="date"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-accent"
                                value={newProject.start_date}
                                onChange={e => setNewProject({ ...newProject, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
                            <input
                                required
                                type="date"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-accent"
                                value={newProject.end_date}
                                onChange={e => setNewProject({ ...newProject, end_date: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? 'Creating...' : 'Submit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <button
                        key={project.id}
                        onClick={() => router.push(`/${user.role}/project/${project.id}`)}
                        className="rounded-xl bg-card border border-border p-5 text-left hover:border-accent transition-colors group cursor-pointer flex flex-col items-start w-full"
                    >
                        {/* Color bar */}
                        <div
                            className="h-2 w-12 rounded-full mb-4"
                            style={{ backgroundColor: project.color || 'hsl(var(--accent))' }}
                        />

                        <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 min-h-[2.5rem]">
                            {project.name}
                        </h3>

                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground italic">
                            {project.description || 'No Company/Client Name'}
                        </div>

                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(project.start_date).toLocaleDateString()} — {new Date(project.end_date).toLocaleDateString()}
                        </div>

                        {/* Admin Display Codes */}
                        {user.role === 'admin' && (
                            <div className="mt-3 bg-secondary/50 self-stretch rounded-md p-2 flex flex-col gap-1 border border-border text-[10px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium uppercase tracking-wider">Contributor:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-foreground font-bold">{project.contributor_code}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCopy(project.contributor_code, `${project.id}-contributor`); }}
                                            className="p-1 hover:bg-secondary rounded transition-colors"
                                        >
                                            {copiedId === `${project.id}-contributor` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium uppercase tracking-wider">Client:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-foreground font-bold">{project.client_code}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCopy(project.client_code, `${project.id}-client`); }}
                                            className="p-1 hover:bg-secondary rounded transition-colors"
                                        >
                                            {copiedId === `${project.id}-client` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats row */}
                        <div className="flex items-center w-full gap-4 mt-4 pt-4 border-t border-border">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="font-medium text-accent">{project.totalDocs || 0}</span> {t('documents').toLowerCase()}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Camera className="h-3.5 w-3.5" />
                                <span className="font-medium text-accent">{project.totalPhotos || 0}</span> {t('photos').toLowerCase()}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                    </button>
                ))}
            </div>

            {projects.length === 0 && (
                <div className="mt-12 text-center">
                    <p className="text-muted-foreground">{t('no_projects')}</p>
                </div>
            )}

            {/* Logo Crop Modal */}
            {isCropModalOpen && !!imgSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-background rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h2 className="font-bold text-lg">Crop Logo</h2>
                            <button onClick={() => { setIsCropModalOpen(false); if (logoInputRef.current) logoInputRef.current.value = ''; }} className="text-muted-foreground hover:text-foreground">
                                ×
                            </button>
                        </div>
                        <div className="p-6 bg-secondary/30 flex-1 overflow-auto flex items-center justify-center">
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={imgSrc}
                                    onLoad={onImageLoad}
                                    style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain' }}
                                />
                            </ReactCrop>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-background">
                            <button
                                onClick={() => { setIsCropModalOpen(false); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadCropped}
                                disabled={!completedCrop?.width || !completedCrop?.height}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                            >
                                Upload Logo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logo Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-background rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsPreviewOpen(false)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors z-10"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="p-8 flex flex-col items-center gap-6">
                            <div className="w-48 h-48 rounded-2xl bg-muted border-2 border-border overflow-hidden flex items-center justify-center shadow-inner">
                                {logoUrl || (user.role === 'superadmin' ? '/app-icon.png' : null) ? (
                                    <img src={logoUrl || '/app-icon.png'} alt="Org Logo Preview" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-muted-foreground font-medium italic">No Logo</span>
                                )}
                            </div>

                            <div className="text-center">
                                <h3 className="text-lg font-bold text-foreground">Organization Logo</h3>
                                <p className="text-sm text-muted-foreground mt-1">This logo represents {orgData?.organization?.name || 'your organization'}.</p>
                            </div>

                            {user.role === 'admin' && (
                                <button
                                    onClick={() => {
                                        setIsPreviewOpen(false);
                                        logoInputRef.current?.click();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Camera className="h-4 w-4" />
                                    Change Logo
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
