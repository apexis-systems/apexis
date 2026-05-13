"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import { ChevronLeft, Video, Phone, Smile, Paperclip, Camera, Mic, Send, Users, Check, CheckCheck, X, FileText, Download, CornerUpLeft, ZoomIn, Loader2, User } from 'lucide-react';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms, uploadChatFile, uploadConfirmationScreenshot, getChatProjects } from '@/services/chatService';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import VoiceNoteRecorder from '@/components/common/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/common/VoiceNotePlayer';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Edit2, LogOut, Plus } from 'lucide-react';
import { getChatUsers } from '@/services/userService';
import { updateRoom, addRoomMembers, removeRoomMember, updateChatMessage, deleteChatMessage } from '@/services/chatService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ChatDetail() {
    const router = useRouter();
    const params = useParams();
    const { socket, isConnected } = useSocket();

    const { user } = useAuth() as any;
    const { t } = useLanguage();

    const role = params?.role as string ?? 'admin';
    const roomId = params?.id as string;

    const [message, setMessage] = useState('');

    if (role === 'superadmin') {
        router.push('/superadmin/dashboard');
        return null;
    }

    const [room, setRoom] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const typingTimeoutRef = useRef<any>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
    const [annotatingFile, setAnnotatingFile] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [replyTo, setReplyTo] = useState<any>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);
    const [viewPhotoName, setViewPhotoName] = useState<string>('');
    const [viewPhotoId, setViewPhotoId] = useState<number>(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [projectsList, setProjectsList] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectingProject, setSelectingProject] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [showRoomDetails, setShowRoomDetails] = useState(false);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            try {
                if (!roomId) return;
                const projects = await getChatProjects(roomId);
                if (projects) {
                    setProjectsList(projects);
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            } finally {
                setLoadingProjects(false);
            }
        };

        if (showProjectPicker) {
            fetchProjects();
        }
    }, [showProjectPicker]);

    const handleDownload = async (messageId: number, fileName: string) => {
        if (!messageId) return;
        try {
            const response = await PrivateAxios.get(`/chats/download/${messageId}`, {
                responseType: 'blob'
            });
            
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', fileName || 'download');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed", err);
        }
    };

    const getActiveProjectId = () => {
        if (room?.project_id) return room.project_id;
        
        // Fallback: If it's a direct chat, see if the users share exactly one project
        if (room?.room_members && room.room_members.length >= 2) {
            const memberProjects = room.room_members.map((m: any) => 
                m.user?.project_members?.map((pm: any) => pm.project_id) || []
            );
            
            const intersection = memberProjects.reduce((a: any[], b: any[]) => 
                a.filter(x => b.includes(x))
            );
            
            if (intersection.length === 1) return intersection[0];
        }
        return null;
    };

    const takeConfirmationScreenshot = async () => {
        if (!chatContainerRef.current) return;
        
        setIsCapturing(true);
        try {
            // Use html-to-image with filter to hide the loader from capture
            const dataUrl = await htmlToImage.toJpeg(document.body, {
                quality: 0.9,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#0b141a' : '#efeae2',
                imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                filter: (node) => {
                    const el = node as HTMLElement;
                    if (el.id === 'capture-loader-overlay') return false;
                    
                    // Exclude external images to prevent strict CORS policies from failing the screenshot
                    if (el.tagName === 'IMG') {
                        const img = el as HTMLImageElement;
                        if (img.src && img.src.startsWith('http') && !img.src.startsWith(window.location.origin)) {
                            return false;
                        }
                    }
                    return true;
                }
            });
            
            const blob = await (await fetch(dataUrl)).blob();
            setCapturedBlob(blob);

            const initialProjectId = getActiveProjectId();
            if (initialProjectId) {
                // If we have a clear project context, upload immediately
                await handleProjectSelected(initialProjectId, blob);
            } else {
                // Otherwise ask the user
                setShowProjectPicker(true);
            }
        } catch (err) {
            console.error("Screenshot failed", err);
            toast.error("Failed to take screenshot");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleProjectSelected = async (projectId: string | number, blobOverride?: Blob) => {
        const blobToUpload = blobOverride || capturedBlob;
        if (!blobToUpload) return;

        setSelectingProject(true);
        try {
            const formData = new FormData();
            formData.append('file', blobToUpload, `confirmation_${Date.now()}.jpg`);
            formData.append('project_id', String(projectId));
            formData.append('skipActivity', 'false');

            const response = await uploadConfirmationScreenshot(formData);

            if (response.status === 200) {
                toast.success("Confirmation screenshot saved to project photos");
                setShowProjectPicker(false);
                setCapturedBlob(null);
            }
        } catch (err) {
            console.error("Upload failed", err);
            toast.error("Failed to save confirmation");
        } finally {
            setSelectingProject(false);
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
        const blob = dataUrlToBlob(annotatedDataUrl);
        const fileName = selectedFile?.name || `annotated_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        setSelectedFile(file);
        setSelectedFilePreview(annotatedDataUrl);
        setAnnotatingFile(false);
    };

    const commonEmojis = ['😊', '😂', '❤️', '👍', '🔥', '🙌', '😮', '😢', '😍', '🤔', '✅', '❌', '🚀', '✨'];

    // Fetch messages on load
    useEffect(() => {
        const fetchMessages = async () => {
            if (!roomId) return;
            try {
                const data = await getRoomMessages(roomId);
                const allRooms = await listRooms();
                const currentRoom = allRooms.find((r: any) => String(r.id) === String(roomId));
                setRoom(currentRoom);
                setMessages([...data].reverse());

                if (document.hasFocus() && user?.id) {
                    data.forEach((msg: any) => {
                        if (!msg.seen && msg.sender_id !== user.id) {
                            markMessageSeen(msg.id);
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to fetch messages", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [roomId, user?.id]);

    // Socket listeners
    useEffect(() => {
        if (!socket || !roomId) return;

        if (isConnected) {
            console.log(`[SOCKET] Web emitting join-room: ${roomId}`);
            socket.emit('join-room', roomId);
        }

        const handleNewMessage = (msg: any) => {
            console.log("[SOCKET] Web received new-message:", msg);
            const incomingRoomId = String(msg.room_id || msg.roomId);
            const currentRoomId = String(params?.id || roomId);

            if (incomingRoomId === currentRoomId) {
                setMessages(prev => {
                    const exists = prev.some(m => String(m.id) === String(msg.id));
                    if (exists) {
                        return prev.map(m => String(m.id) === String(msg.id) ? msg : m);
                    }
                    return [msg, ...prev];
                });

                if (msg.sender_id !== user?.id && msg.senderId !== user?.id) {
                    playNotificationSound();
                }

                if (document.hasFocus() && user?.id && msg.sender_id !== user.id && msg.senderId !== user.id) {
                    markMessageSeen(msg.id);
                }
            }
        };

        const playNotificationSound = () => {
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                audio.play().catch(e => console.error("Sound play failed:", e));
            } catch (err) {
                console.error("Audio error:", err);
            }
        };

        const handleMessageSeen = ({ messageId }: { messageId: number }) => {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, seen: true } : m));
        };

        const handleStatusChange = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(String(userId));
                else next.delete(String(userId));
                return next;
            });
        };

        const handleTyping = ({ roomId: tid, userName }: { roomId: string | number, userName: string }) => {
            if (String(tid) === String(roomId)) {
                setTypingUser(userName);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
            }
        };

        room?.room_members?.forEach((m: any) => {
            if (m.user?.id && String(m.user.id) !== String(user?.id)) {
                socket.emit('check-user-status', m.user.id);
            }
        });

        socket.on('new-message', handleNewMessage);
        socket.on('message-seen-update', handleMessageSeen);
        socket.on('user-status-changed', handleStatusChange);
        socket.on('user-status-response', handleStatusChange);
        socket.on('user-typing', handleTyping);

        socket.on('room-updated', ({ roomId: rid, name }: any) => {
            if (String(rid) === String(roomId)) {
                setRoom((prev: any) => ({ ...prev, name }));
            }
        });

        socket.on('members-added', ({ roomId: rid }: any) => {
            if (String(rid) === String(roomId)) {
                // Re-fetch room to get new members
                listRooms().then(rooms => {
                    const currentRoom = rooms.find((r: any) => String(r.id) === String(roomId));
                    if (currentRoom) setRoom(currentRoom);
                });
            }
        });

        socket.on('member-removed', ({ roomId: rid, userId: uid }: any) => {
            if (String(rid) === String(roomId)) {
                if (String(uid) === String(user?.id)) {
                    router.push(`/${role}/chats`);
                } else {
                    setRoom((prev: any) => ({
                        ...prev,
                        room_members: prev.room_members.filter((m: any) => String(m.user?.id) !== String(uid))
                    }));
                }
            }
        });

        socket.on('message-updated', ({ messageId, text }: any) => {
            setMessages(prev => prev.map(m => String(m.id) === String(messageId) ? { ...m, text } : m));
        });

        socket.on('message-deleted', ({ messageId }: any) => {
            setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
        });

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-seen-update', handleMessageSeen);
            socket.off('user-status-changed', handleStatusChange);
            socket.off('user-status-response', handleStatusChange);
            socket.off('user-typing', handleTyping);
            socket.off('room-updated');
            socket.off('members-added');
            socket.off('member-removed');
            socket.off('message-updated');
            socket.off('message-deleted');
        };
    }, [socket, isConnected, roomId, user?.id, room?.id]);

    const isInitialLoadRef = useRef(true);
    // Scroll to bottom when messages change or loading finishes
    useEffect(() => {
        if (!loading && messages.length > 0) {
            if (isInitialLoadRef.current) {
                bottomRef.current?.scrollIntoView({ behavior: 'auto' });
                isInitialLoadRef.current = false;
            } else {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages, loading]);

    const handleSend = async (overrideFile?: File) => {
        if (editingMessage) {
            handleUpdateMessage();
            return;
        }

        const tempText = message.trim();
        const fileToUpload = overrideFile || selectedFile;

        if (!tempText && !fileToUpload) return;

        setIsUploading(true);

        if (!overrideFile) {
            setMessage('');
            setSelectedFile(null);
            setSelectedFilePreview(null);
            setShowEmojiPicker(false);
        }

        try {
            let fileData = null;
            if (fileToUpload) {
                const uploadRes = await uploadChatFile(fileToUpload);
                if (uploadRes.success) {
                    fileData = uploadRes;
                }
            }

            const payload: any = {
                roomId,
                type: fileData ? (
                    fileData.file_type.startsWith('image/') ? 'image' :
                    fileData.file_type.startsWith('audio/') ? 'audio' : 'file'
                ) : 'text',
                file_url: fileData?.file_url,
                file_name: fileData?.file_name,
                file_type: fileData?.file_type,
                file_size: fileData?.file_size,
                parent_id: replyTo?.id ? Number(replyTo.id) : null
            };
            if (tempText) payload.text = tempText;
            
            console.log("[CHAT] Sending payload:", payload);
            setReplyTo(null);

            const res = await sendChatMessage(payload);
            console.log("[CHAT] Response from server:", res);
            if (res.success && res.message) {
                setMessages(prev => {
                    const exists = prev.some(m => String(m.id) === String(res.message.id));
                    if (exists) {
                        return prev.map(m => String(m.id) === String(res.message.id) ? res.message : m);
                    }
                    return [res.message, ...prev];
                });
            }
        } catch (err) {
            console.error("Failed to send message", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => setSelectedFilePreview(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                setSelectedFilePreview(null);
            }
        }
    };

    const addEmoji = (emoji: string) => {
        setMessage(prev => prev + emoji);
        // setShowEmojiPicker(false);
    };
 
    const scrollToMessage = (messageId: number) => {
        const element = document.getElementById(`msg-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-accent/10');
            setTimeout(() => element.classList.remove('bg-accent/10'), 2000);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleUpdateMessage = async () => {
        if (!editingMessage || !message.trim()) return;
        try {
            await updateChatMessage(editingMessage.id, message.trim());
            setEditingMessage(null);
            setMessage('');
        } catch (err) {
            console.error("Failed to update message", err);
            toast.error("Failed to edit message");
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        if (!confirm("Are you sure you want to delete this message?")) return;
        try {
            await deleteChatMessage(messageId);
        } catch (err) {
            console.error("Failed to delete message", err);
            toast.error("Failed to delete message");
        }
    };

    const handleUpdateRoomName = async (newName: string) => {
        if (!newName.trim() || newName === room.name) return;
        setIsUpdatingRoom(true);
        try {
            await updateRoom(roomId, { name: newName.trim() });
            toast.success("Group name updated");
        } catch (err) {
            toast.error("Failed to update group name");
        } finally {
            setIsUpdatingRoom(false);
        }
    };

    const handleAddMember = async (userId: number) => {
        try {
            await addRoomMembers(roomId, [userId]);
            toast.success("Member added");
        } catch (err) {
            toast.error("Failed to add member");
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!confirm("Remove this member from group?")) return;
        try {
            await removeRoomMember(roomId, userId);
            toast.success("Member removed");
        } catch (err) {
            toast.error("Failed to remove member");
        }
    };

    const handleLeaveRoom = async () => {
        if (!confirm("Leave this group?")) return;
        try {
            await removeRoomMember(roomId, user.id);
            router.push(`/${role}/chats`);
        } catch (err) {
            toast.error("Failed to leave group");
        }
    };

    useEffect(() => {
        if (showRoomDetails) {
            const fetchUsers = async () => {
                setLoadingUsers(true);
                try {
                    const users = await getChatUsers();
                    setAllUsers(users.filter((u: any) => u.id !== user?.id && u.role !== 'superadmin'));
                } catch (err) {
                    console.error("Failed to fetch users", err);
                } finally {
                    setLoadingUsers(false);
                }
            };
            fetchUsers();
        }
    }, [showRoomDetails, user?.id]);

    if (loading) return <div className="p-6 text-center text-muted-foreground">{t('loading_messages')}</div>;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-3 bg-card border-b border-border shrink-0">
                <button
                    onClick={() => router.push(`/${role}/chats`)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-primary shrink-0"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

                <div 
                    className="flex flex-1 items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors p-1 rounded-lg min-w-0"
                    onClick={() => setShowRoomDetails(true)}
                >
                    {room?.type === 'group' ? (
                        <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-white" />
                        </div>
                    ) : (
                        <SecureAvatar
                            fileKey={room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.profile_pic}
                            name={room?.name || room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.name}
                            size="h-9 w-9"
                        />
                    )}

                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">
                            {room?.name || room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.name || t('loading_chats')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {room?.type === 'group'
                                ? t('members_count').replace('{count}', (room.room_members?.length || 0).toString())
                                : (onlineUsers.has(String(room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.id)) ? t('online') : t('offline'))}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Call icons removed as requested */}
                </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 relative flex flex-col min-h-0" ref={chatContainerRef}>
                <div
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-2 flex flex-col-reverse"
                    style={{ background: 'var(--chat-bg, #efeae2)' }}
                >
                    <style>{`
                        :root { --chat-bg: #efeae2; }
                        .dark { --chat-bg: #0b141a; }
                    `}</style>

                    <div className="flex-1 min-h-0 shrink-0 pointer-events-none" />

                    <div ref={bottomRef} />
                    {messages.map(msg => {
                        const isMe = msg.sender_id === user?.id;
                        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} transition-colors duration-500 rounded-2xl`}>
                                <div
                                    className={`max-w-[75%] px-3.5 py-2.5 shadow-sm ${isMe
                                        ? 'bg-accent text-white rounded-2xl rounded-br-sm'
                                        : 'bg-card text-foreground border border-border rounded-2xl rounded-bl-sm'
                                        }`}
                                >
                                    {!isMe && (
                                        <p className="text-accent text-xs font-semibold mb-1">{msg.sender?.name || t('user_fallback')}</p>
                                    )}

                                    {(msg.parent || msg.parent_id) && (
                                        <div 
                                            onClick={() => scrollToMessage(msg.parent_id || (msg.parent as any)?.id)}
                                            className={`p-2 mb-2 rounded-lg border-l-4 border-accent text-xs cursor-pointer hover:opacity-80 transition-opacity ${isMe ? 'bg-white/10 border-white/40' : 'bg-secondary/50'}`}
                                        >
                                            <p className={`font-bold mb-0.5 truncate ${isMe ? 'text-white' : 'text-accent'}`}>
                                                {msg.parent?.sender?.name || t('user_fallback')}
                                            </p>
                                            <p className={`opacity-80 line-clamp-1 italic ${isMe ? 'text-white/90' : 'text-foreground/70'}`}>
                                                {msg.parent ? (
                                                    (msg.parent.type === 'audio' || msg.parent.file_type?.startsWith('audio/')) ? `🎤 ${t('voice_note')}` : msg.parent.type === 'image' ? `📷 ${t('photo_message')}` : msg.parent.type === 'file' ? `📄 ${t('file_message')}` : msg.parent.text || t('message_fallback')
                                                ) : t('replied_to_message')}
                                            </p>
                                        </div>
                                    )}

                                    {msg.type === 'image' && msg.downloadUrl && (
                                        <div className="mb-2 rounded-lg overflow-hidden border border-border/50 bg-secondary/20 relative group cursor-pointer" onClick={() => { setViewPhoto(msg.downloadUrl); setViewPhotoName(msg.file_name || 'image.jpg'); setViewPhotoId(msg.id); }}>
                                            <img
                                                src={msg.downloadUrl}
                                                alt={msg.file_name}
                                                className="max-w-full h-auto block"
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <ZoomIn className="h-6 w-6 text-white" />
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(msg.id, msg.file_name || 'image.jpg');
                                                }}
                                                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                            >
                                                <Download className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}

                                    {(msg.type === 'audio' || msg.file_type?.startsWith('audio/')) && msg.downloadUrl && (
                                        <div className="mb-2">
                                            <VoiceNotePlayer url={msg.downloadUrl} isMe={isMe} />
                                        </div>
                                    )}

                                    {msg.type === 'file' && !msg.file_type?.startsWith('audio/') && msg.downloadUrl && (
                                        <div className={`p-2 mb-2 rounded-lg flex items-center gap-3 ${isMe ? 'bg-white/10' : 'bg-secondary/50'}`}>
                                            <FileText className="h-8 w-8 text-accent" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{msg.file_name}</p>
                                                <p className="text-[10px] opacity-70">{msg.file_size || '0 KB'}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(msg.id, msg.file_name || 'file')}
                                                className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                                            >
                                                <Download className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}

                                    {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                                    <div className={`flex items-center gap-1 mt-1 justify-end`}>
                                        <span className={`text-[10px] ${isMe ? 'text-orange-100' : 'text-muted-foreground'}`}>
                                            {time}
                                        </span>
                                        {isMe && (
                                            <div className="flex items-center">
                                                {msg.seen ? (
                                                    <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 text-orange-100 opacity-70" />
                                                )}
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setReplyTo(msg);
                                                inputRef.current?.focus();
                                            }}
                                            className={`ml-1 p-0.5 rounded hover:bg-black/10 transition-colors ${isMe ? 'text-white' : 'text-accent'}`}
                                            title="Reply"
                                        >
                                            <CornerUpLeft className="h-3 w-3" />
                                        </button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className={`p-0.5 rounded hover:bg-black/10 transition-colors ${isMe ? 'text-white' : 'text-accent'}`}>
                                                    <MoreVertical className="h-3 w-3" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={takeConfirmationScreenshot} className="text-xs cursor-pointer">
                                                    Confirm as Confirmation
                                                </DropdownMenuItem>
                                                {isMe && msg.type === 'text' && (
                                                    <DropdownMenuItem onClick={() => { setEditingMessage(msg); setMessage(msg.text); setReplyTo(null); setTimeout(() => inputRef.current?.focus(), 100); }} className="text-xs cursor-pointer">
                                                        <Edit2 className="h-3 w-3 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                )}
                                                {isMe && (
                                                    <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="text-xs cursor-pointer text-destructive focus:text-destructive">
                                                        <Trash2 className="h-3 w-3 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Floating Typing Indicator */}
                {typingUser && (
                    <div className="absolute bottom-3 left-5 z-20 pointer-events-none">
                        <p className="text-primary text-[11px] font-semibold animate-pulse italic drop-shadow-sm">
                            {t('user_is_typing').replace('{name}', typingUser)}
                        </p>
                    </div>
                )}

            </div>


            <div className="shrink-0 bg-card border-t border-border relative">
                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-4 mb-2 bg-card border border-border rounded-xl shadow-xl p-3 z-50 grid grid-cols-7 gap-2">
                        {commonEmojis.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => addEmoji(emoji)}
                                className="text-xl hover:scale-125 transition-transform"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* File Preview */}
                {selectedFile && (
                    <div className="px-4 py-2 bg-secondary/30 flex items-center gap-3 border-b border-border animate-in slide-in-from-bottom-2">
                        <div
                            className="relative h-10 w-10 rounded bg-accent/20 flex items-center justify-center overflow-hidden group cursor-pointer"
                            onClick={() => selectedFile.type.startsWith('image/') && setAnnotatingFile(true)}
                        >
                            {selectedFile.type.startsWith('image/') && selectedFilePreview ? (
                                <>
                                    <img src={selectedFilePreview} className="h-full w-full object-cover rounded" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="h-3 w-3 text-white" />
                                    </div>
                                </>
                            ) : (
                                <FileText className="h-6 w-6 text-accent" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                            <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                            onClick={() => { setSelectedFile(null); setSelectedFilePreview(null); }}
                            className="p-1 rounded-full hover:bg-secondary transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Edit Preview */}
                {editingMessage && (
                    <div className="px-4 py-3 bg-accent/10 flex items-center gap-3 border-b border-border border-l-4 border-l-primary animate-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-primary">Editing Message</p>
                            <p className="text-sm text-foreground truncate opacity-80">{editingMessage.text}</p>
                        </div>
                        <button
                            onClick={() => { setEditingMessage(null); setMessage(''); }}
                            className="p-1 rounded-full hover:bg-secondary transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Reply Preview */}
                {replyTo && (
                    <div className="px-4 py-3 bg-secondary/30 flex items-center gap-3 border-b border-border border-l-4 border-l-accent animate-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-accent">{replyTo.sender?.name || t('user_fallback')}</p>
                            <p className="text-sm text-foreground truncate opacity-80">
                                { (replyTo.type === 'audio' || replyTo.file_type?.startsWith('audio/')) ? `🎤 ${t('voice_note')}` : replyTo.type === 'image' ? `📷 ${t('photo_message')}` : replyTo.type === 'file' ? `📄 ${t('file_message')}` : replyTo.text || t('message_fallback')}
                            </p>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="p-1 rounded-full hover:bg-secondary transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <div className="px-3 py-3 flex items-end gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <input
                        type="file"
                        ref={cameraInputRef}
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                    />

                    {!isRecordingVoice && (
                        <div className="flex-1 bg-background rounded-xl border border-border flex items-center px-3 py-1 shadow-sm">
                            <textarea
                                ref={inputRef}
                                value={message}
                                onChange={e => {
                                    setMessage(e.target.value);
                                    if (socket && roomId && user?.name) {
                                        socket.emit('typing', { roomId, userName: user.name });
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={t('message_placeholder')}
                                rows={1}
                                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-32 py-0.5"
                                style={{ lineHeight: '1.4' }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-muted-foreground hover:text-foreground transition-colors rotate-[-45deg] pb-0.5"
                            >
                                <Paperclip className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="text-muted-foreground hover:text-foreground transition-colors pb-0.5"
                            >
                                <Camera className="h-5 w-5" />
                            </button>
                        </div>
                    )}

                    {(!message.trim() && !selectedFile) || isRecordingVoice ? (
                        <VoiceNoteRecorder 
                            onRecordingStateChange={setIsRecordingVoice}
                            onSend={(file) => handleSend(file)}
                        />
                    ) : (
                        <button
                            onClick={() => handleSend()}
                            disabled={isUploading}
                            className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shrink-0 hover:bg-accent/90 transition-colors shadow-md disabled:opacity-50"
                        >
                            {isUploading ? (
                                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="h-4.5 w-4.5 text-white translate-x-0.5" />
                            )}
                        </button>
                    )}
                </div>
            </div>


            {/* Room Details Modal */}
            <Dialog open={showRoomDetails} onOpenChange={setShowRoomDetails}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b bg-secondary/10">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3">
                            {room?.type === 'group' ? (
                                <><Users className="h-5 w-5 text-primary" /> Group Information</>
                            ) : (
                                <><User className="h-5 w-5 text-primary" /> User Profile</>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
                        {room?.type === 'direct' ? (
                            <div className="flex flex-col items-center text-center space-y-4">
                                <SecureAvatar 
                                    fileKey={room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.profile_pic}
                                    name={room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.name}
                                    size="h-24 w-24"
                                />
                                <div>
                                    <h3 className="text-xl font-bold">{room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.name}</h3>
                                    <p className="text-muted-foreground uppercase text-xs font-bold tracking-wider mt-1">
                                        {room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.role}
                                    </p>
                                    <p className="text-primary text-sm font-medium mt-1">
                                        {room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.organization?.name}
                                    </p>
                                </div>
                                <div className="w-full pt-4 border-t border-border">
                                    <h4 className="text-sm font-bold text-left mb-3">Project Roles</h4>
                                    <div className="space-y-2">
                                        {room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.project_members?.map((pm: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border">
                                                <span className="text-sm font-medium truncate flex-1 mr-2">{pm.project?.name}</span>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-accent border-accent/20 bg-accent/5">{pm.role}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Group Name</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            defaultValue={room?.name} 
                                            onBlur={e => handleUpdateRoomName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleUpdateRoomName(e.currentTarget.value)}
                                            className="bg-secondary/20"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Members ({room?.room_members?.length})</label>
                                        <button 
                                            onClick={handleLeaveRoom}
                                            className="text-xs font-bold text-destructive hover:underline flex items-center gap-1"
                                        >
                                            <LogOut className="h-3 w-3" /> Leave Group
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {room?.room_members?.map((member: any) => (
                                            <div key={member.user?.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                                                <SecureAvatar 
                                                    fileKey={member.user?.profile_pic}
                                                    name={member.user?.name}
                                                    size="h-8 w-8"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{member.user?.name} {member.user?.id === user?.id && '(You)'}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{member.user?.role}</p>
                                                </div>
                                                {member.user?.id !== user?.id && (
                                                    <button onClick={() => handleRemoveMember(member.user?.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-border">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Add New Member</label>
                                    <Input 
                                        placeholder="Search members to add..." 
                                        value={userSearchQuery}
                                        onChange={e => setUserSearchQuery(e.target.value)}
                                        className="bg-secondary/10"
                                    />
                                    <div className="space-y-2">
                                        {loadingUsers ? (
                                            <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                                        ) : (
                                            allUsers
                                                .filter(u => !room?.room_members?.some((m: any) => m.user?.id === u.id))
                                                .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                                .slice(0, 5)
                                                .map(u => (
                                                    <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                                <span className="text-white text-xs font-bold">{u.name.charAt(0)}</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{u.name}</span>
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{u.organization?.name}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleAddMember(u.id)}
                                                            className="p-1.5 rounded-full hover:bg-primary hover:text-white transition-all text-primary"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {annotatingFile && selectedFilePreview && (
                <ImageAnnotator
                    imageSrc={selectedFilePreview}
                    onSave={handleAnnotateSave}
                    onCancel={() => setAnnotatingFile(false)}
                />
            )}

            {/* Photo Viewer */}
            <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
                <DialogContent className="max-w-4xl p-2 no-scrollbar">
                    {viewPhoto && (
                        <div className="relative flex flex-col items-center">
                            <img src={viewPhoto} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {isCapturing && (
                <div id="capture-loader-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center text-white">
                    <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-lg font-bold">Capturing Confirmation...</p>
                    <p className="text-sm opacity-80">This will take a moment</p>
                </div>
            )}

            {/* Project Selection Dialog */}
            <Dialog open={showProjectPicker} onOpenChange={setShowProjectPicker}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Which project should this confirmation screenshot be saved to?
                        </p>
                        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-border">
                            {loadingProjects ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center">
                                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-sm text-muted-foreground font-medium">Fetching projects...</p>
                                </div>
                            ) : projectsList.length > 0 ? (
                                projectsList.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleProjectSelected(p.id)}
                                        disabled={selectingProject}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-secondary/40 transition-all text-left border border-border/50 hover:border-primary/30 group"
                                    >
                                        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                            <span className="text-primary font-bold text-lg">{p.name ? p.name.charAt(0).toUpperCase() : '?'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="font-bold text-[15px] truncate text-foreground">{p.name || 'Untitled Project'}</p>
                                                {p.user_role && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                                                        {p.user_role}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">{p.description || 'No project description'}</p>
                                            <p className="text-[10px] text-muted-foreground/60 uppercase font-medium mt-1">{p.organization?.name}</p>
                                        </div>
                                        {selectingProject ? (
                                            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors rotate-180" />
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <div className="h-12 w-12 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                        <FileText className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">No projects found</p>
                                    <p className="text-xs text-muted-foreground mt-1">You aren't assigned to any projects yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
