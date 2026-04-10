"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Video, Phone, Smile, Paperclip, Camera, Mic, Send, Users, Check, CheckCheck, X, FileText, Download, CornerUpLeft } from 'lucide-react';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms, uploadChatFile } from '@/services/chatService';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import SecureAvatar from '@/components/shared/SecureAvatar';

export default function ChatDetail() {
    const router = useRouter();
    const params = useParams();
    const { socket, isConnected } = useSocket();

    const { user } = useAuth() as any;

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
                setMessages(data);

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
            const incomingRoomId = String(msg.room_id || msg.roomId);
            const currentRoomId = String(params?.id || roomId);

            if (incomingRoomId === currentRoomId) {
                setMessages(prev => {
                    const exists = prev.find(m => String(m.id) === String(msg.id));
                    if (exists) return prev;
                    return [...prev, msg];
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

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-seen-update', handleMessageSeen);
            socket.off('user-status-changed', handleStatusChange);
            socket.off('user-status-response', handleStatusChange);
            socket.off('user-typing', handleTyping);
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

    const handleSend = async () => {
        if ((!message.trim() && !selectedFile) || !roomId) return;

        const tempText = message.trim();
        const fileToUpload = selectedFile;

        setMessage('');
        setSelectedFile(null);
        setSelectedFilePreview(null);
        setShowEmojiPicker(false);

        try {
            let fileData = null;
            if (fileToUpload) {
                setIsUploading(true);
                const uploadRes = await uploadChatFile(fileToUpload);
                if (uploadRes.success) {
                    fileData = uploadRes;
                }
                setIsUploading(false);
            }

            const payload: any = {
                roomId,
                type: fileData ? (fileData.file_type.startsWith('image/') ? 'image' : 'file') : 'text',
                file_url: fileData?.file_url,
                file_name: fileData?.file_name,
                file_type: fileData?.file_type,
                file_size: fileData?.file_size,
                parent_id: replyTo?.id || null
            };
            if (tempText) payload.text = tempText;
            
            setReplyTo(null);

            const res = await sendChatMessage(payload);
            if (res.success && res.message) {
                setMessages(prev => {
                    if (prev.find(m => m.id === res.message.id)) return prev;
                    return [...prev, res.message];
                });
            }
        } catch (err) {
            console.error("Failed to send message", err);
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

    if (loading) return <div className="p-6 text-center text-muted-foreground">Loading messages...</div>;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
                <button
                    onClick={() => router.push(`/${role}/chats`)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-primary"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

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
                        {room?.name || room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.name || 'Loading...'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        {room?.type === 'group'
                            ? `${room.room_members?.length || 0} members`
                            : (onlineUsers.has(String(room?.room_members?.find((m: any) => m.user?.id !== user?.id)?.user?.id)) ? 'Online' : 'Offline')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Call icons removed as requested */}
                </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 relative flex flex-col min-h-0">
                <div
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
                    style={{ background: 'var(--chat-bg, #efeae2)' }}
                >
                    <style>{`
                        :root { --chat-bg: #efeae2; }
                        .dark { --chat-bg: #0b141a; }
                    `}</style>

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
                                        <p className="text-accent text-xs font-semibold mb-1">{msg.sender?.name || 'User'}</p>
                                    )}

                                    {msg.parent && (
                                        <div 
                                            onClick={() => scrollToMessage(msg.parent_id)}
                                            className={`p-2 mb-2 rounded-lg border-l-4 border-accent text-xs cursor-pointer hover:opacity-80 transition-opacity ${isMe ? 'bg-white/10' : 'bg-secondary/50'}`}
                                        >
                                            <p className="font-bold text-accent mb-0.5">{msg.parent.sender?.name}</p>
                                            <p className="opacity-70 line-clamp-1">
                                                {msg.parent.type === 'image' ? '📷 Photo' : msg.parent.type === 'file' ? '📄 File' : msg.parent.text}
                                            </p>
                                        </div>
                                    )}

                                    {msg.type === 'image' && msg.downloadUrl && (
                                        <div className="mb-2 rounded-lg overflow-hidden border border-border/50 bg-secondary/20 relative group">
                                            <img
                                                src={msg.downloadUrl}
                                                alt={msg.file_name}
                                                className="max-w-full h-auto cursor-pointer block"
                                                onClick={() => window.open(msg.downloadUrl, '_blank')}
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(msg.downloadUrl, '_blank');
                                                }}
                                                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Download className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}

                                    {msg.type === 'file' && msg.downloadUrl && (
                                        <div className={`p-2 mb-2 rounded-lg flex items-center gap-3 ${isMe ? 'bg-white/10' : 'bg-secondary/50'}`}>
                                            <FileText className="h-8 w-8 text-accent" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{msg.file_name}</p>
                                                <p className="text-[10px] opacity-70">{msg.file_size || '0 KB'}</p>
                                            </div>
                                            <button
                                                onClick={() => window.open(msg.downloadUrl, '_blank')}
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
                                            onClick={() => setReplyTo(msg)}
                                            className={`ml-1 p-0.5 rounded hover:bg-black/10 transition-colors ${isMe ? 'text-white' : 'text-accent'}`}
                                        >
                                            <CornerUpLeft className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* Floating Typing Indicator */}
                {typingUser && (
                    <div className="absolute bottom-3 left-5 z-20 pointer-events-none">
                        <p className="text-primary text-[11px] font-semibold animate-pulse italic drop-shadow-sm">
                            {typingUser} is typing...
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

                {/* Reply Preview */}
                {replyTo && (
                    <div className="px-4 py-3 bg-secondary/30 flex items-center gap-3 border-b border-border border-l-4 border-l-accent animate-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-accent">{replyTo.sender?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                                {replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'file' ? '📄 File' : replyTo.text}
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

                    <div className="flex-1 flex items-end bg-secondary/50 border border-border rounded-2xl px-3 py-2 gap-2 min-h-[44px]">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`transition-colors pb-0.5 ${showEmojiPicker ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Smile className="h-5 w-5" />
                        </button>
                        <textarea
                            value={message}
                            onChange={e => {
                                setMessage(e.target.value);
                                if (socket && roomId && user?.name) {
                                    socket.emit('typing', { roomId, userName: user.name });
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Message..."
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

                    <button
                        onClick={handleSend}
                        disabled={isUploading}
                        className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shrink-0 hover:bg-accent/90 transition-colors shadow-md disabled:opacity-50"
                    >
                        {isUploading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send className="h-4.5 w-4.5 text-white translate-x-0.5" />
                        )}
                    </button>
                </div>
            </div>

            {annotatingFile && selectedFilePreview && (
                <ImageAnnotator
                    imageSrc={selectedFilePreview}
                    onSave={handleAnnotateSave}
                    onCancel={() => setAnnotatingFile(false)}
                />
            )}
        </div>
    );
}
