"use client";

import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    X, Plus, MessageSquare, ImagePlus, ZoomIn, Loader2, Pencil,
    AlertCircle, CheckCircle, AlertTriangle, Clock, User, Camera, Folder, CheckCheck, FileText, Eye, Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/helpers/apiError';
import {
    RFI, RFIStatus, ConversationMessage, getRFIs, createRFI, updateRFIStatus, getRFIAssignees,
    deleteRFI,
    updateRFI,
    getRFIById,
    markRFISeen,
    getRFIMessages,
    sendRFIMessage,
    RFIAssignee,
    linkRfiFile,
    deleteRfiLink
} from '@/services/rfiService';
import { Assignee } from '@/services/snagService';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import FolderPickerDialog from './FolderPickerDialog';
import VoiceNoteRecorder from '@/components/common/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/common/VoiceNotePlayer';
import FileViewer from '@/components/shared/FileViewer';
import LinkFileModal from '@/components/shared/LinkFileModal';

const FilePaperclip = ({ className }: { className?: string }) => {
    return (
        <div className={cn("relative flex items-center justify-center shrink-0", className)}>
            <FileText className="h-[90%] w-[90%] -translate-x-[5%] -translate-y-[5%]" />
            <Paperclip className="absolute -bottom-[3px] -right-[3px] h-[65%] w-[65%] bg-background text-inherit rounded-full p-[0.5px]" />
        </div>
    );
};

const isAudio = (url: string) => {
    if (!url) return false;
    try {
        const urlWithoutQuery = url.split('?')[0];
        return !!urlWithoutQuery.match(/\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i);
    } catch {
        return false;
    }
};

const isImage = (url: string) => {
    if (!url) return false;
    try {
        const urlWithoutQuery = url.split('?')[0];
        return !!urlWithoutQuery.match(/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i);
    } catch {
        return false;
    }
};

const getFileNameFromUrl = (url: string) => {
    if (!url) return 'Document';
    try {
        const withoutQuery = url.split('?')[0];
        const parts = withoutQuery.split('/');
        return parts[parts.length - 1] || 'Document';
    } catch {
        return 'Document';
    }
};

const getMimeTypeFromUrl = (url: string) => {
    if (!url) return 'application/octet-stream';
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'ppt': return 'application/vnd.ms-powerpoint';
        case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case 'txt': return 'text/plain';
        case 'csv': return 'text/csv';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        default: return 'application/octet-stream';
    }
};

const fetchDocumentMetadata = async (url: string) => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Range': 'bytes=0-0'
            }
        });
        
        const contentType = response.headers.get('content-type');
        const contentRange = response.headers.get('content-range');
        const contentLength = response.headers.get('content-length');
        
        let sizeBytes = 0;
        if (contentRange) {
            const parts = contentRange.split('/');
            if (parts.length > 1) {
                sizeBytes = parseInt(parts[1], 10);
            }
        } else if (contentLength) {
            sizeBytes = parseInt(contentLength, 10);
        }
        
        let sizeStr = '';
        if (sizeBytes > 0) {
            const sizeMB = sizeBytes / (1024 * 1024);
            sizeStr = sizeMB < 0.1 ? `${(sizeBytes / 1024).toFixed(1)} KB` : `${sizeMB.toFixed(1)} MB`;
        }
        
        return {
            type: contentType || getMimeTypeFromUrl(url),
            size: sizeStr || undefined
        };
    } catch (error) {
        console.error('Error fetching document metadata:', error);
        return {
            type: getMimeTypeFromUrl(url),
            size: undefined
        };
    }
};

const isImageFile = (
    fileOrUrl: any,
    docMetadata?: Record<string, { size?: string; type?: string }>
): boolean => {
    if (!fileOrUrl) return false;
    
    if (typeof File !== 'undefined' && fileOrUrl instanceof File) {
        return fileOrUrl.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i.test(fileOrUrl.name);
    }
    
    if (typeof fileOrUrl === 'string') {
        if (isImage(fileOrUrl)) return true;
        const meta = docMetadata?.[fileOrUrl];
        if (meta?.type?.toLowerCase().startsWith('image/')) return true;
        return false;
    }
    
    const name = fileOrUrl.file_name || fileOrUrl.name || '';
    const type = fileOrUrl.file_type || fileOrUrl.type || '';
    const downloadUrl = fileOrUrl.downloadUrl || fileOrUrl.url || '';
    
    if (type.toLowerCase().startsWith('image/') || type.toLowerCase().includes('image')) return true;
    if (isImage(name) || isImage(downloadUrl)) return true;
    
    if (downloadUrl) {
        const meta = docMetadata?.[downloadUrl];
        if (meta?.type?.toLowerCase().startsWith('image/')) return true;
    }
    return false;
};

const isAudioFile = (
    fileOrUrl: any,
    docMetadata?: Record<string, { size?: string; type?: string }>
): boolean => {
    if (!fileOrUrl) return false;
    
    if (typeof File !== 'undefined' && fileOrUrl instanceof File) {
        return fileOrUrl.type.startsWith('audio/') || /\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i.test(fileOrUrl.name);
    }
    
    if (typeof fileOrUrl === 'string') {
        if (isAudio(fileOrUrl)) return true;
        const meta = docMetadata?.[fileOrUrl];
        if (meta?.type?.toLowerCase().startsWith('audio/')) return true;
        return false;
    }
    
    const name = fileOrUrl.file_name || fileOrUrl.name || '';
    const type = fileOrUrl.file_type || fileOrUrl.type || '';
    const downloadUrl = fileOrUrl.downloadUrl || fileOrUrl.url || '';
    
    if (type.toLowerCase().startsWith('audio/') || type.toLowerCase().includes('audio')) return true;
    if (isAudio(name) || isAudio(downloadUrl)) return true;
    
    if (downloadUrl) {
        const meta = docMetadata?.[downloadUrl];
        if (meta?.type?.toLowerCase().startsWith('audio/')) return true;
    }
    return false;
};

const getLinkedDocuments = (rfi: any, docMetadata?: Record<string, { size?: string; type?: string }>) => {
    const list: { id?: string | number; name: string; url: string; size?: string; type?: string; file_size_mb?: number; folder_id?: string | number; file_type?: string }[] = [];
    if (!rfi) return list;

    if (rfi.file_rfi_links && Array.isArray(rfi.file_rfi_links)) {
        rfi.file_rfi_links.forEach((link: any) => {
            const file = link.file || link;
            const url = file.downloadUrl || file.url || '';
            if (!url) return;
            if (!isImageFile(file, docMetadata) && !isAudioFile(file, docMetadata)) {
                const meta = docMetadata?.[url];
                list.push({
                    id: file.id || link.file_id,
                    name: file.file_name || file.name || url.split('/').pop() || 'File',
                    url,
                    type: meta?.type || file.file_type || '',
                    size: meta?.size || (file.file_size_mb ? `${file.file_size_mb.toFixed(1)} MB` : undefined),
                    file_size_mb: file.file_size_mb,
                    folder_id: file.folder_id,
                    file_type: file.file_type,
                });
            }
        });
    }

    return list;
};

const getLinkedImages = (rfi: any, docMetadata?: Record<string, { size?: string; type?: string }>) => {
    const list: { id?: number | string; url: string; folder_id?: string | number; file_type?: string }[] = [];
    if (!rfi) return list;

    if (rfi.photoDownloadUrls && Array.isArray(rfi.photoDownloadUrls)) {
        rfi.photoDownloadUrls.forEach((url: string) => {
            if (isImageFile(url, docMetadata) && !list.find(i => i.url === url)) {
                list.push({ url });
            }
        });
    }

    // Also include image files from file_rfi_links
    if (rfi.file_rfi_links && Array.isArray(rfi.file_rfi_links)) {
        rfi.file_rfi_links.forEach((link: any) => {
            const file = link.file || link;
            const url = file.downloadUrl || file.url || '';
            if (!url) return;
            if (isImageFile(file, docMetadata) && !list.find(i => i.url === url)) {
                list.push({ id: file.id || link.file_id, url, folder_id: file.folder_id, file_type: file.file_type });
            }
        });
    }

    return list;
};

const getLinkedAudios = (rfi: any, docMetadata?: Record<string, { size?: string; type?: string }>) => {
    const list: { id?: number; url: string }[] = [];
    if (!rfi) return list;

    if (rfi.photoDownloadUrls && Array.isArray(rfi.photoDownloadUrls)) {
        rfi.photoDownloadUrls.forEach((url: string) => {
            if (isAudioFile(url, docMetadata) && !list.find(a => a.url === url)) {
                list.push({ url });
            }
        });
    }

    return list;
};

const mergeUniqueMessages = (messages: ConversationMessage[]) => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const idStr = String(message.id);
    if (seen.has(idStr)) return false;
    seen.add(idStr);
    return true;
  });
};

interface ProjectRFIProps {
    project: Project;
    onUpdate?: () => void;
}

const STATUS_CONFIG: Record<RFIStatus, { icon: React.ElementType; color: string; bg: string; key: string }> = {
    open: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', key: 'open_status' },
    closed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-600/10', key: 'closed_status' },
    overdue: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', key: 'overdue_status' },
};

export default function ProjectRFI({ project, onUpdate }: ProjectRFIProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { checkLimit } = useUsage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialRfiId = searchParams?.get('rfiId');

    const [rfis, setRfis] = useState<RFI[]>([]);
    const [assignees, setAssignees] = useState<RFIAssignee[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | RFIStatus>('all');
    const [creatorFilter, setCreatorFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

    // Modals
    const [showAdd, setShowAdd] = useState(false);
    const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newExpiryDate, setNewExpiryDate] = useState('');
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [newAudio, setNewAudio] = useState<File | null>(null);
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
    const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
    const [existingAudioKey, setExistingAudioKey] = useState<string | null>(null);
    const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [messageFile, setMessageFile] = useState<File | null>(null);
    const [messagePreview, setMessagePreview] = useState<string | null>(null);
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [selectedFolderIds, setSelectedFolderIds] = useState<(string | number)[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [docMetadata, setDocMetadata] = useState<Record<string, { size?: string; type?: string }>>({});
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [viewerFiles, setViewerFiles] = useState<any[]>([]);

    const handleCloseDetailDialog = () => {
        setSelectedRFI(null);
        const returnTab = searchParams?.get('returnTab');
        if (returnTab) {
            const returnFolderId = searchParams?.get('returnFolderId');
            const returnFileId = searchParams?.get('returnFileId');
            const returnViewerTab = searchParams?.get('returnViewerTab');
            const params = new URLSearchParams();
            params.set('tab', returnTab);
            if (returnFolderId) params.set('folder', returnFolderId);
            if (returnFileId) {
                params.set('fileId', returnFileId);
                params.set('viewerTab', 'links');

            }
            if (returnViewerTab) {
                params.set('viewerSubTab', returnViewerTab);
            }
            // Clear return params from URL
            const url = window.location.pathname + '?' + params.toString();
            router.push(url);
        }
    };

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
        const fileName = newPhotos[annotatingIdx]?.name || `annotated_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        setNewPhotos((prev: File[]) => {
            const copy = [...prev];
            copy[annotatingIdx] = file;
            return copy;
        });
        
        setPhotoPreviews((prev: string[]) => {
            const copy = [...prev];
            copy[annotatingIdx] = annotatedDataUrl;
            return copy;
        });
        
        setAnnotatingIdx(null);
    };

    const hasExistingFormAudio = !!existingAudioUrl && !audioPreview;

    const isConversationParticipant = !!selectedRFI && (
        String(selectedRFI.assigned_to) === String(user?.id) ||
        String(selectedRFI.created_by) === String(user?.id) ||
        String(selectedRFI.creator?.id) === String(user?.id)
    );
    const isConversationClosed = selectedRFI?.status === 'closed';

    useEffect(() => {
        if (selectedRFI && String(selectedRFI.assigned_to) === String(user?.id) && !selectedRFI.seen_at) {
            markRFISeen(selectedRFI.id).then(data => {
                setSelectedRFI(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
                setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, seen_at: data.seen_at } : r));
            }).catch(err => console.error("Failed to mark RFI as seen:", err));
        }
    }, [selectedRFI?.id, user?.id]);

    useEffect(() => {
        if (!selectedRFI) {
            setConversationMessages([]);
            setMessageText('');
            setMessageFile(null);
            setMessagePreview(null);
            return;
        }

        setLoadingMessages(true);
        getRFIMessages(selectedRFI.id)
            .then(messages => setConversationMessages(mergeUniqueMessages(messages)))
            .catch(() => toast.error(t('failed_update_response')))
            .finally(() => setLoadingMessages(false));
    }, [selectedRFI?.id]);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (!loadingMessages) {
            setTimeout(scrollToBottom, 100);
        }
    }, [conversationMessages, loadingMessages]);

    const load = async (silent = false) => {
        if (!project?.id) return;
        if (!silent) setLoading(true);
        try {
            const [rfiData, assigneeData] = await Promise.all([
                getRFIs(project.id),
                getRFIAssignees(project.id),
            ]);
            setRfis(rfiData);
            setAssignees(assigneeData);
        } catch (e) {
            toast.error(t('failed_load_rfis'));
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); }, [project?.id]);

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket || !project?.id) return;

        socket.emit('join-project', project.id);

        const onRFSeen = (data: { rfiId: number, seen_at: string }) => {
            setRfis(prev => prev.map(r => r.id === data.rfiId ? { ...r, seen_at: data.seen_at } : r));
            setSelectedRFI(prev => (prev && prev.id === data.rfiId) ? { ...prev, seen_at: data.seen_at } : prev);
        };

        const onRFIUpdated = (data: { rfi: RFI }) => {
            setRfis(prev => {
                const idx = prev.findIndex(r => r.id === data.rfi.id);
                if (idx !== -1) {
                    const copy = [...prev];
                    copy[idx] = data.rfi;
                    return copy;
                }
                return [data.rfi, ...prev];
            });
            setSelectedRFI(prev => (prev && prev.id === data.rfi.id) ? data.rfi : prev);
        };

        const onConversationMessage = (data: { itemType: 'rfi' | 'snag', itemId: number, message: ConversationMessage }) => {
            if (data.itemType !== 'rfi') return;
            setConversationMessages(prev => {
                if (!selectedRFI || selectedRFI.id !== data.itemId) return prev;
                return mergeUniqueMessages([...prev, data.message]);
            });
        };

        const onRFIDeleted = (data: { rfiId: number }) => {
            setRfis(prev => prev.filter(r => r.id !== data.rfiId));
            setSelectedRFI(prev => (prev && prev.id === data.rfiId) ? null : prev);
        };

        socket.on('rfi-seen', onRFSeen);
        socket.on('rfi-updated', onRFIUpdated);
        socket.on('rfi-deleted', onRFIDeleted);
        socket.on('rfi-conversation-message', onConversationMessage);

        return () => {
            socket.off('rfi-seen', onRFSeen);
            socket.off('rfi-updated', onRFIUpdated);
            socket.off('rfi-deleted', onRFIDeleted);
            socket.off('rfi-conversation-message', onConversationMessage);
        };
    }, [socket, project?.id, selectedRFI?.id]);

    useEffect(() => {
        if (initialRfiId) {
            const openRFI = (target: RFI) => {
                setSelectedRFI(target);
                // Clear the ID from URL to prevent loop on back navigation
                const params = new URLSearchParams(window.location.search);
                params.delete('rfiId');
                const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
            };

            const existing = rfis.find(r => String(r.id) === String(initialRfiId));
            if (existing) {
                openRFI(existing);
            } else {
                // Fetch specific RFI for faster redirection
                getRFIById(Number(initialRfiId)).then(openRFI).catch(() => {
                    // Fallback: clear param if fetch fails
                    const params = new URLSearchParams(window.location.search);
                    params.delete('rfiId');
                    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                    window.history.replaceState({}, '', newUrl);
                });
            }
        }
    }, [initialRfiId, rfis]);

    useEffect(() => {
        if (!selectedRFI) return;
        
        const docs = getLinkedDocuments(selectedRFI, docMetadata);
        const urlsToFetch = docs
            .filter(doc => !doc.size) // only those without metadata/size
            .map(doc => doc.url);
            
        if (urlsToFetch.length === 0) return;
        
        const fetchAll = async () => {
            const updates: Record<string, { size?: string; type?: string }> = {};
            await Promise.all(
                urlsToFetch.map(async (url) => {
                    const meta = await fetchDocumentMetadata(url);
                    if (meta) {
                        updates[url] = meta;
                    }
                })
            );
            if (Object.keys(updates).length > 0) {
                setDocMetadata(prev => ({ ...prev, ...updates }));
            }
        };
        
        fetchAll();
    }, [selectedRFI?.id]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        if (validFiles.length !== files.length) toast.error(t('some_files_skipped_msg'));

        const total = newPhotos.length + validFiles.length;
        if (total > 4) {
            toast.error(t('max_4_photos_msg'));
            return;
        }

        setNewPhotos(prev => [...prev, ...validFiles]);

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => setPhotoPreviews(prev => [...prev, reader.result as string]);
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (idx: number) => {
        setNewPhotos((prev: File[]) => prev.filter((_, i) => i !== idx));
        setPhotoPreviews((prev: string[]) => prev.filter((_, i) => i !== idx));
    };

    const addRFI = async () => {
        if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
        if (!newAssignee) { toast.error(t('assignee_required_msg')); return; }

        if (!checkLimit('rfis')) {
            toast.error(t('rfi_limit_msg'), {
                action: {
                    label: t('upgrade_label'),
                    onClick: () => router.push(`/${user?.role || 'admin'}/billing`)
                },
                duration: 5000,
            });
            return;
        }

        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('project_id', String(project.id));
            form.append('title', newTitle.trim());
            form.append('description', newDescription.trim());
            form.append('assigned_to', newAssignee);
            if (newExpiryDate) form.append('expiry_date', newExpiryDate);
            newPhotos.forEach(photo => form.append('photos', photo));
            if (newAudio) form.append('photos', newAudio);
            if (selectedFolderIds.length > 0) {
                form.append('folder_ids', selectedFolderIds.join(','));
            }

            await createRFI(form);
            toast.success(t('rfi_created_msg'));
            setShowAdd(false);
            resetForm();
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_create_rfi')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateLinks = async (ids: (string | number)[]) => {
        if (!selectedRFI) return;
        setSubmitting(true);
        try {
            const numericIds = ids.map(Number);
            const form = new FormData();
            form.append('folder_ids', numericIds.join(','));
            const updated = await updateRFI(selectedRFI.id, form);
            setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, folder_ids: numericIds, linked_folders: updated.linked_folders } : r));
            setSelectedRFI(prev => prev ? { ...prev, folder_ids: numericIds, linked_folders: updated.linked_folders } : null);
            toast.success(t('links_updated_msg'));
            setShowFolderPicker(false);
        } catch (error) {
            toast.error(t('failed_update_links'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleLinkFile = async (targetFileId: string | number) => {
        if (!selectedRFI) return;
        setSubmitting(true);
        try {
            await linkRfiFile(selectedRFI.id, Number(targetFileId));
            const updated = await getRFIById(selectedRFI.id);
            setSelectedRFI(updated);
            setRfis(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast.success(t('link_success') || 'File linked successfully');
            setShowFilePicker(false);
        } catch (error) {
            toast.error(t('link_failed') || 'Failed to link file');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveFileLink = async (targetFileId: string | number) => {
        if (!selectedRFI) return;
        try {
            await deleteRfiLink(selectedRFI.id, Number(targetFileId));
            const updated = await getRFIById(selectedRFI.id);
            setSelectedRFI(updated);
            setRfis(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast.success(t('link_removed') || 'Link removed successfully');
        } catch (error) {
            toast.error(t('link_remove_failed') || 'Failed to remove link');
        }
    };

    const handleUpdateRFI = async () => {
        if (!selectedRFI) return;
        if (!newTitle.trim()) { toast.error(t('title_required_msg')); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('title', newTitle.trim());
            form.append('description', newDescription.trim());
            form.append('assigned_to', newAssignee);
            if (newExpiryDate) form.append('expiry_date', newExpiryDate);
            newPhotos.forEach(photo => form.append('photos', photo));
            if (newAudio) form.append('photos', newAudio);
            if (removedPhotos.length > 0) {
                form.append('removedPhotos', JSON.stringify(removedPhotos));
            }
            form.append('folder_ids', selectedFolderIds.join(','));

            const updated = await updateRFI(selectedRFI.id, form);
            toast.success(t('rfi_updated_msg'));
            setIsEditing(false);
            setRfis(prev => prev.map(r => r.id === selectedRFI.id ? updated : r));
            setSelectedRFI(updated);
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_update_rfi')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRFI = async (id: number) => {
        if (!confirm(t('confirm_delete_rfi'))) return;
        try {
            await deleteRFI(id);
            toast.success(t('rfi_deleted_msg'));
            setRfis(prev => prev.filter(r => r.id !== id));
            setSelectedRFI(null);
            load(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_delete_rfi')));
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewDescription('');
        setNewAssignee('');
        setNewExpiryDate('');
        setNewPhotos([]);
        setPhotoPreviews([]);
        setNewAudio(null);
        setAudioPreview(null);
        setRemovedPhotos([]);
        setExistingAudioUrl(null);
        setExistingAudioKey(null);
        setSelectedFolderIds([]);
    };

    const handleSendMessage = async () => {
        if (!selectedRFI) return;
        if (!messageText.trim() && !messageFile) return;
        setSubmitting(true);
        try {
            const form = new FormData();
            if (messageText.trim()) form.append('text', messageText.trim());
            if (messageFile) form.append('file', messageFile);

            const message = await sendRFIMessage(selectedRFI.id, form);
            setConversationMessages(prev => mergeUniqueMessages([...prev, message]));
            setMessageText('');
            setMessageFile(null);
            setMessagePreview(null);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('failed_update_response')));
        } finally {
            setSubmitting(false);
        }
    };

    const handleMessageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isAllowed = file.type.startsWith('image/') || file.type.startsWith('audio/');
        if (!isAllowed) {
            toast.error('Only image and audio attachments are supported');
            return;
        }
        setMessageFile(file);
        setMessagePreview(URL.createObjectURL(file));
        e.target.value = '';
    };

    const handleStatusUpdate = async (id: number, status: RFIStatus) => {
        try {
            await updateRFIStatus(id, status);
            toast.success(t('status_updated_to_msg').replace('{label}', t(STATUS_CONFIG[status].key)));
            
            // Update the list locally by only changing the status field
            setRfis(prev => prev.map(r => r.id === id ? { ...r, status } : r));
            
            if (onUpdate) onUpdate();
            
            // Update the selected RFI view if it's the one being modified
            if (selectedRFI?.id === id) {
                setSelectedRFI({ ...selectedRFI, status });
            }            toast.success(t('status_updated_msg'));
        } catch (err) {
            toast.error(t('failed_update_status'));
        }
    };

    const handleLinkItemClick = (item: any) => {
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentTab = currentUrlParams.get('tab') || 'rfi';
        
        if (item.type === 'file') {
            const targetTab = (item.file_type?.toLowerCase().includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.url || '')) ? 'photos' : 'documents';
            const extraParams = new URLSearchParams();
            extraParams.set('tab', targetTab);
            let folderId = item.folder_id;
            if (!folderId) {
                const urlToParse = item.url || item.file_url;
                if (urlToParse) {
                    const match = urlToParse.match(/folders\/([^/]+)/);
                    if (match) folderId = match[1];
                }
            }
            if (folderId) extraParams.set('folder', String(folderId));
            extraParams.set('fileId', String(item.file_id || item.id));
            extraParams.set('viewerTab', 'links');
            if (selectedRFI?.id) {
                extraParams.set('returnTab', currentTab);
                extraParams.set('returnRfiId', String(selectedRFI.id));
            }
            router.push(window.location.pathname + `?${extraParams.toString()}`);
        } else {
            if (item.url) {
                try {
                    const hasPath = item.url.includes('?');
                    const [urlPath, queryStr] = hasPath ? item.url.split('?') : [item.url, ''];
                    const targetParams = new URLSearchParams(queryStr);
                    
                    targetParams.set('returnTab', currentTab);
                    if (selectedRFI?.id) targetParams.set('returnRfiId', String(selectedRFI.id));
                    
                    const newUrl = urlPath ? `${urlPath}?${targetParams.toString()}` : `${window.location.pathname}?${targetParams.toString()}`;
                    router.push(newUrl);
                } catch {
                    router.push(item.url);
                }
            }
        }
    };

    const hasExistingResponseAudio = !!selectedRFI?.response_photos?.some(p => p.match(/\.(m4a|webm|mp3|wav|aac|ogg)(\?.*)?$/i));

    const filteredRfis = rfis.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesCreator = creatorFilter === 'all' || String(r.created_by) === creatorFilter;
        const matchesAssignee = assigneeFilter === 'all' || String(r.assigned_to) === assigneeFilter;
        return matchesStatus && matchesCreator && matchesAssignee;
    });

    if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold">{t('request_for_info_title')}</h2>
                    <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> {t('new_rfi_btn')}
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-secondary/20 rounded-xl border border-border">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('status_label')}</label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | RFIStatus)}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_status')}</SelectItem>
                                <SelectItem value="open">{t('open_status')}</SelectItem>
                                <SelectItem value="overdue">{t('overdue_status')}</SelectItem>
                                <SelectItem value="closed">{t('closed_status')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('created_by_label')}</label>
                        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_creators_label')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_creators_label')}</SelectItem>
                                {Array.from(new Set(rfis.map(r => r.creator?.id))).filter(Boolean).map(id => {
                                    const name = rfis.find(r => r.creator?.id === id)?.creator?.name;
                                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('assigned_to_label')}</label>
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="h-9 text-xs bg-background">
                                <SelectValue placeholder={t('all_assignees_label')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('all_assignees_label')}</SelectItem>
                                {Array.from(new Set(rfis.map(r => r.assignee?.id))).filter(Boolean).map(id => {
                                    const name = rfis.find(r => r.assignee?.id === id)?.assignee?.name;
                                    return <SelectItem key={id} value={String(id)}>{name}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end pb-0.5">
                        {(statusFilter !== 'all' || creatorFilter !== 'all' || assigneeFilter !== 'all') && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[10px] h-8 text-muted-foreground hover:text-foreground"
                                onClick={() => { setStatusFilter('all'); setCreatorFilter('all'); setAssigneeFilter('all'); }}
                            >
                                {t('clear_all_btn')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredRfis.map((rfi) => {
                    const cfg = STATUS_CONFIG[rfi.status];
                    const StatusIcon = cfg.icon;
                    return (
                        <div
                            key={rfi.id}
                            onClick={() => setSelectedRFI(rfi)}
                            className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-accent/50 transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={cn("mt-1 p-2 rounded-lg", cfg.bg)}>
                                        <StatusIcon className={cn("h-4 w-4", cfg.color)} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">{rfi.title}</h3>
                                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", cfg.bg, cfg.color)}>
                                                {t(cfg.key)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{rfi.description}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex flex-col items-end gap-1">
                                        <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                            <Clock className="h-3 w-3" /> {new Date(rfi.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border">
                                        <span className="text-[10px] font-bold">{rfi.creator?.name?.charAt(0)}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{t('by_user_label').replace('{name}', rfi.creator?.name || '')}</span>
                                </div>
                                {rfi.assignee && (
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3 text-accent" />
                                        <span className="text-[10px] font-medium text-accent">{t('assigned_to_user_label').replace('{name}', rfi.assignee.name)}</span>
                                    </div>
                                )}
                                {rfi.seen_at && (
                                    <div className="flex items-center gap-0.5 text-orange-500" title={`Seen at ${new Date(rfi.seen_at).toLocaleString()}`}>
                                        <CheckCheck className="h-3.5 w-3.5" />
                                        <span className="text-[8px] font-bold uppercase tracking-tighter">{t('seen_badge')}</span>
                                    </div>
                                )}
                                {rfi.photos && rfi.photos.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Camera className="h-3 w-3" />
                                        <span className="text-[10px]">{t('attachments_count_label').replace('{count}', String(rfi.photos.length))}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredRfis.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
                        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground font-medium">{t('no_rfis_found')}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{t('rfi_filter_empty_desc')}</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={showAdd || isEditing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setIsEditing(false); resetForm(); } }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? t('edit_rfi_title') : t('new_rfi_title')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('title_label')}</label>
                            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('rfi_title_placeholder')} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('description_label')}</label>
                            <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder={t('rfi_context_placeholder')} className="min-h-[100px]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('assign_to_label')}</label>
                            <Select value={newAssignee} onValueChange={setNewAssignee}>
                                <SelectTrigger><SelectValue placeholder={t('select_assignee_placeholder')} /></SelectTrigger>
                                <SelectContent>
                                    {assignees.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('expiry_date_label')}</label>
                            <Input type="datetime-local" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('attachments_label')}</label>
                            <div className="flex flex-wrap gap-2">
                                {photoPreviews.map((src, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => setAnnotatingIdx(idx)} className="bg-accent p-1.5 rounded-full hover:scale-110 transition-transform">
                                                <Camera className="h-3 w-3 text-white" />
                                            </button>
                                            <button onClick={() => removePhoto(idx)} className="bg-destructive p-1.5 rounded-full hover:scale-110 transition-transform">
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {photoPreviews.length < 4 && (
                                    <label className="w-20 h-20 border-dashed border-2 border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('voice_note_label')}</label>
                            {audioPreview ? (
                                <div className="relative rounded-xl border border-border bg-card p-4 pr-10">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
                                    </div>
                                    <VoiceNotePlayer url={audioPreview} isMe={false} />
                                    <button onClick={() => { setNewAudio(null); setAudioPreview(null); }} className="absolute top-2 right-2 rounded-full bg-destructive/90 p-1.5">
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ) : hasExistingFormAudio ? (
                                <div className="relative rounded-xl border border-border bg-card p-4 pr-10">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{t('voice_note_label')}</span>
                                    </div>
                                    <VoiceNotePlayer url={existingAudioUrl!} isMe={false} />
                                    <button
                                        onClick={() => {
                                            if (existingAudioKey) setRemovedPhotos(prev => [...prev, existingAudioKey]);
                                            setExistingAudioUrl(null);
                                            setExistingAudioKey(null);
                                        }}
                                        className="absolute top-2 right-2 rounded-full bg-destructive/90 p-1.5"
                                    >
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <VoiceNoteRecorder
                                    onSend={(file) => {
                                        setNewAudio(file);
                                        setAudioPreview(URL.createObjectURL(file));
                                    }}
                                />
                            )}
                        </div>

                        {/* <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Link to Folders</label>
                            <div className="flex flex-wrap gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[10px]" 
                                    onClick={() => setShowFolderPicker(true)}
                                >
                                    <Folder className="h-3 w-3 mr-1.5" />
                                    {selectedFolderIds.length > 0 ? `Manage Folders (${selectedFolderIds.length})` : 'Select Folders'}
                                </Button>
                            </div>
                        </div> */}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setShowAdd(false); setIsEditing(false); resetForm(); }} disabled={submitting}>{t('cancel')}</Button>
                        <Button onClick={isEditing ? handleUpdateRFI : addRFI} disabled={submitting || !newTitle.trim()} className="bg-accent text-accent-foreground">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isEditing ? <CheckCircle className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />)}
                            {isEditing ? t('save_changes') : t('create_rfi_btn')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!selectedRFI} onOpenChange={(open) => !open && handleCloseDetailDialog()}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto no-scrollbar">
                    {selectedRFI && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between gap-3 mb-2 pr-8">
                                    <div className="flex items-center gap-3">
                                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", STATUS_CONFIG[selectedRFI.status].bg, STATUS_CONFIG[selectedRFI.status].color)}>
                                            {t(STATUS_CONFIG[selectedRFI.status].key)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{t('rfi_id_label').replace('{id}', String(selectedRFI.id))}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(String(selectedRFI.created_by) === String(user?.id) || String(selectedRFI.creator?.id) === String(user?.id) || String(selectedRFI.assigned_to) === String(user?.id) || String(selectedRFI.assignee?.id) === String(user?.id)) && (
                                            <>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => setShowFilePicker(true)}
                                                >
                                                    <FilePaperclip className="h-3.5 w-3.5 mr-1.5" />
                                                    {t('link_files') || 'Link Files'}
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => {
                                                        setSelectedFolderIds(selectedRFI.linked_folders?.map(f => f.id) || []);
                                                        setShowFolderPicker(true);
                                                    }}
                                                >
                                                    <Folder className="h-3 w-3 mr-1.5" />
                                                    {t('link_btn')}
                                                </Button>
                                            </>
                                        )}
                                        {(String(selectedRFI.created_by) === String(user?.id) || String(selectedRFI.creator?.id) === String(user?.id)) && (
                                            <>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => {
                                                        setNewTitle(selectedRFI.title);
                                                        setNewDescription(selectedRFI.description || '');
                                                        setNewAssignee(String(selectedRFI.assigned_to));
                                                        setNewExpiryDate(selectedRFI.expiry_date ? new Date(selectedRFI.expiry_date).toISOString().slice(0, 16) : '');
                                                        const allAttachments = selectedRFI.photoDownloadUrls || [];
                                                        const imageAttachments = allAttachments.filter(url => isImageFile(url, docMetadata));
                                                        const audioAttachment = allAttachments.find(url => isAudioFile(url, docMetadata)) || null;
                                                        const audioKeyIndex = allAttachments.findIndex(url => isAudioFile(url, docMetadata));
                                                        setPhotoPreviews(imageAttachments);
                                                        setNewPhotos([]);
                                                        setNewAudio(null);
                                                        setAudioPreview(null);
                                                        setRemovedPhotos([]);
                                                        setExistingAudioUrl(audioAttachment);
                                                        setExistingAudioKey(audioKeyIndex >= 0 ? (selectedRFI.photos?.[audioKeyIndex] || null) : null);
                                                        setSelectedFolderIds(selectedRFI.linked_folders?.map(f => f.id) || []);
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    {t('edit_btn')}
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    className="h-7 text-[10px]"
                                                    onClick={() => {
                                                        if (confirm(t('confirm_delete_rfi'))) {
                                                            deleteRFI(selectedRFI.id).then(() => {
                                                                setRfis(prev => prev.filter(r => r.id !== selectedRFI.id));
                                                                handleCloseDetailDialog();
                                                                toast.success(t('rfi_deleted_msg'));
                                                            }).catch(() => toast.error(t('failed_delete_rfi')));
                                                        }
                                                    }}
                                                >
                                                    {t('delete_btn')}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <DialogTitle className="text-xl leading-tight">{selectedRFI.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <div>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedRFI.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('created_by_label')}</p>
                                        <p className="text-xs font-semibold">{selectedRFI.creator?.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedRFI.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('assigned_to_label')}</p>
                                        <p className="text-xs font-semibold">{selectedRFI.assignee?.name || t('unassigned_label')}</p>
                                    </div>
                                    {selectedRFI.expiry_date && (
                                        <div className="col-span-2 mt-2 pt-2 border-t border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('expiry_date_label')}</p>
                                            <p className={cn("text-xs font-semibold flex items-center gap-1.5", 
                                                selectedRFI.status === 'overdue' ? 'text-destructive' : 'text-foreground')}>
                                                <Clock className="h-3 w-3" />
                                                {new Date(selectedRFI.expiry_date).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {selectedRFI.linked_folders && selectedRFI.linked_folders.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('linked_folders_title')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRFI.linked_folders.map((f: { id: number; name: string; folder_type: string }) => (
                                                <button 
                                                    key={f.id} 
                                                    onClick={() => {
                                                        const rfiId = selectedRFI.id;
                                                        setSelectedRFI(null);
                                                        const params = new URLSearchParams();
                                                        params.set('tab', f.folder_type === 'photo' ? 'photos' : 'documents');
                                                        params.set('folder', String(f.id));
                                                        params.set('returnTab', 'rfi');
                                                        params.set('returnRfiId', String(rfiId));
                                                        router.push(window.location.pathname + `?${params.toString()}`);
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/5 border border-accent/10 text-[10px] font-semibold text-accent hover:bg-accent/10 transition-colors"
                                                >
                                                    <Folder className="h-2.5 w-2.5" />
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments Section */}
                                {(() => {
                                    const images = getLinkedImages(selectedRFI, docMetadata);
                                    const audios = getLinkedAudios(selectedRFI, docMetadata);
                                    if (images.length === 0 && audios.length === 0) return null;
                                    return (
                                        <div className="space-y-4 pt-2">
                                            {images.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('attachments') || 'Attachments'}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {images.map((img, idx) => (
                                                            <div 
                                                                key={idx}
                                                                onClick={() => {
                                                                    if (img.id) {
                                                                        // Navigate to photos tab, open that file, with return context to come back here
                                                                        const params = new URLSearchParams();
                                                                        params.set('tab', 'photos');
                                                                        if (img.folder_id) params.set('folder', String(img.folder_id));
                                                                        params.set('fileId', String(img.id));
                                                                        params.set('returnTab', 'rfi');
                                                                        params.set('returnRfiId', String(selectedRFI.id));
                                                                        setSelectedRFI(null);
                                                                        router.push(window.location.pathname + `?${params.toString()}`);
                                                                    } else {
                                                                        setViewPhoto(img.url);
                                                                    }
                                                                }}
                                                                className="relative w-24 h-24 rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:border-accent/30 transition-all cursor-pointer group"
                                                            >
                                                                <img 
                                                                    src={img.url} 
                                                                    alt={`Attachment ${idx + 1}`} 
                                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <ZoomIn className="h-5 w-5 text-white" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {audios.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('voiceAttachment') || 'Voice Attachment'}</p>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {audios.map((aud, idx) => (
                                                            <div 
                                                                key={idx}
                                                                className="p-3 rounded-xl border border-border bg-card shadow-sm"
                                                            >
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                                                                    <span className="text-[9px] font-extrabold text-muted-foreground tracking-wider uppercase">{t('voiceAttachment') || 'Voice Attachment'}</span>
                                                                </div>
                                                                <VoiceNotePlayer url={aud.url} isMe={false} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="space-y-3 pt-4 border-t border-border">
                                    <style>{`
                                        .no-scrollbar::-webkit-scrollbar {
                                            display: none;
                                        }
                                    `}</style>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('response_title')}</p>
                                    <div 
                                        ref={chatContainerRef} 
                                        className="space-y-3 max-h-[340px] overflow-y-auto pr-1 no-scrollbar" 
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        {loadingMessages ? (
                                            <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('loading')}</div>
                                        ) : (conversationMessages.length === 0 && !selectedRFI?.response && (!selectedRFI?.responsePhotoUrls || selectedRFI.responsePhotoUrls.length === 0)) ? (
                                            <p className="text-xs text-muted-foreground">No messages yet.</p>
                                        ) : (
                                            <>
                                                {/* Legacy Response Block */}
                                                {(selectedRFI?.response || (selectedRFI?.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0)) && (
                                                    <div className="flex justify-start mb-3">
                                                        <div className="max-w-[80%] rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                                                            <p className="text-[10px] font-bold mb-1 text-muted-foreground">
                                                                Response
                                                            </p>
                                                            {selectedRFI.response && (
                                                                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{selectedRFI.response}</p>
                                                            )}
                                                            {selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    {selectedRFI.responsePhotoUrls.map((url, idx) => {
                                                                        const isAudioFile = isAudio(url);
                                                                        if (isAudioFile) {
                                                                            return (
                                                                                <div key={idx} className="w-full max-w-sm mt-1">
                                                                                    <VoiceNotePlayer url={url} isMe={false} />
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            return (
                                                                                <img
                                                                                    key={idx}
                                                                                    src={url}
                                                                                    alt="Response image"
                                                                                    className="max-h-36 rounded-lg border border-black/5 cursor-pointer"
                                                                                    onClick={() => setViewPhoto(url)}
                                                                                />
                                                                            );
                                                                        }
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Chat Messages */}
                                                {conversationMessages.map((message) => {
                                                    const isMine = String(message.sender_id) === String(user?.id);
                                                    return (
                                                        <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                                                            <div className={cn("max-w-[80%] rounded-2xl border px-3 py-2 shadow-sm", isMine ? "bg-accent text-accent-foreground border-accent/40" : "bg-card border-border")}>
                                                                <p className={cn("text-[10px] font-bold mb-1", isMine ? "text-accent-foreground/80" : "text-muted-foreground")}>
                                                                    {message.sender?.name || (isMine ? 'You' : 'User')}
                                                                </p>
                                                                {message.text && <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>}
                                                                {message.attachment_type === 'image' && message.downloadUrl && (
                                                                    <img
                                                                        src={message.downloadUrl}
                                                                        alt={message.file_name || 'Message attachment'}
                                                                        className="mt-2 max-h-56 rounded-lg border border-black/5 cursor-pointer"
                                                                        onClick={() => setViewPhoto(message.downloadUrl!)}
                                                                    />
                                                                )}
                                                                {message.attachment_type === 'audio' && message.downloadUrl && (
                                                                    <div className="mt-2">
                                                                        <VoiceNotePlayer url={message.downloadUrl} isMe={isMine} />
                                                                    </div>
                                                                )}
                                                                <p className={cn("mt-2 text-[10px]", isMine ? "text-accent-foreground/70" : "text-muted-foreground")}>
                                                                    {new Date(message.createdAt).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Linked Attachments Pill */}
                                {(selectedRFI.file_rfi_links && selectedRFI.file_rfi_links.length > 0) ? (
                                    <div className="flex justify-end mt-3 mb-1">
                                        <button
                                            onClick={() => setShowFilePicker(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                                        >
                                            <FilePaperclip className="h-3.5 w-3.5" />
                                            <span className="text-xs font-bold">
                                                {selectedRFI.file_rfi_links.length} {selectedRFI.file_rfi_links.length === 1 ? 'Linked File' : 'Linked Files'}
                                            </span>
                                        </button>
                                    </div>
                                ) : null}

                                {isConversationParticipant && (
                                    <div className="pt-4 border-t border-border space-y-3 mt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Conversation</p>
                                        {isConversationClosed ? (
                                            <div className="rounded-xl border border-border bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">
                                                {t('closed_status')} - messages are disabled.
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
                                                {messagePreview && (
                                                    <div className={cn("rounded-2xl border border-border bg-secondary/20 p-3", messageFile && isAudioFile(messageFile) ? "" : "")}>
                                                        {messageFile && isAudioFile(messageFile) ? (
                                                            <VoiceNotePlayer url={messagePreview} isMe={false} />
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <img src={messagePreview} alt="Message preview" className="w-20 h-20 rounded-xl object-cover border border-border" />
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="text-sm font-semibold">{t('photo')}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium cursor-pointer hover:bg-secondary/40 transition-colors">
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                            Edit
                                                                            <input type="file" accept="image/*" className="hidden" onChange={handleMessageFileSelect} />
                                                                        </label>
                                                                        <button
                                                                            onClick={() => {
                                                                                setMessageFile(null);
                                                                                setMessagePreview(null);
                                                                            }}
                                                                            className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                            Remove
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {messageFile && isAudioFile(messageFile) ? (
                                                            <div className="flex justify-end mt-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setMessageFile(null);
                                                                        setMessagePreview(null);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                                <Textarea
                                                    placeholder={t('rfi_response_placeholder')}
                                                    value={messageText}
                                                    onChange={e => setMessageText(e.target.value)}
                                                    className="min-h-[96px] resize-none text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0"
                                                />
                                                <div className="flex items-end gap-3">
                                                    <div className="flex flex-1 items-center gap-3">
                                                        {!messageFile && !isVoiceRecording && (
                                                            <label className="w-11 h-11 rounded-xl border border-border bg-background flex items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors shrink-0">
                                                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                                                <input type="file" accept="image/*,audio/*" className="hidden" onChange={handleMessageFileSelect} />
                                                            </label>
                                                        )}
                                                        {!messageFile && (
                                                            <div className="flex-1 min-w-0">
                                                                <VoiceNoteRecorder
                                                                    onRecordingStateChange={setIsVoiceRecording}
                                                                    onSend={(file) => {
                                                                        setMessageFile(file);
                                                                        setMessagePreview(URL.createObjectURL(file));
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isVoiceRecording && (
                                                        <Button
                                                            onClick={handleSendMessage}
                                                            disabled={submitting || (!messageText.trim() && !messageFile)}
                                                            className="min-w-[140px] h-11 rounded-xl bg-accent text-accent-foreground"
                                                        >
                                                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                                                            Send message
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isConversationParticipant && (
                                    <div className="pt-4 border-t border-border space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('update_status_title')}</p>
                                        <div className="flex gap-2">
                                            {(['open', 'closed', 'overdue'] as RFIStatus[]).map((s) => (
                                                <Button
                                                    key={s}
                                                    variant={selectedRFI.status === s ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={cn("flex-1 text-[10px] h-8", selectedRFI.status === s && STATUS_CONFIG[s].bg && STATUS_CONFIG[s].color && "opacity-100")}
                                                    onClick={() => handleStatusUpdate(selectedRFI.id, s)}
                                                >
                                                    {t(STATUS_CONFIG[s].key)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {annotatingIdx !== null && (
                <ImageAnnotator 
                    imageSrc={photoPreviews[annotatingIdx]} 
                    onSave={handleAnnotateSave} 
                    onCancel={() => setAnnotatingIdx(null)} 
                />
            )}

        {/* Photo Viewer */}
        <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
            <DialogContent className="max-w-2xl p-2 no-scrollbar">
                {viewPhoto && (
                    <img src={viewPhoto} alt="Preview" className="w-full h-auto rounded-lg" />
                )}
            </DialogContent>
        </Dialog>

        <FolderPickerDialog 
            open={showFolderPicker}
            onOpenChange={setShowFolderPicker}
            project={project}
            selectedFolderIds={selectedFolderIds}
            submitting={submitting}
            onSelect={async (ids) => {
                setSelectedFolderIds(ids);
                if (selectedRFI && !isEditing) {
                    await handleUpdateLinks(ids);
                } else {
                    setShowFolderPicker(false);
                }
            }}
        />

        {selectedRFI && showFilePicker && (
            <LinkFileModal
                open={showFilePicker}
                onOpenChange={setShowFilePicker}
                projectId={String(project.id)}
                linkedFileIds={selectedRFI.file_rfi_links?.map((l: any) => l.file_id) || []}
                onLink={handleLinkFile}
                onRemoveLink={handleRemoveFileLink}
                handleLinkItemClick={handleLinkItemClick}
            />
        )}
    </div>
    );
}
