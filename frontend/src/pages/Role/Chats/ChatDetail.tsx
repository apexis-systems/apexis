"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Video, Phone, Smile, Paperclip, Camera, Mic, Send, Users, Check, CheckCheck } from 'lucide-react';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms } from '@/services/chatService';
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

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!message.trim() || !roomId) return;
        const tempText = message.trim();
        setMessage('');
        try {
            const res = await sendChatMessage({ roomId, text: tempText });
            if (res.success && res.message) {
                setMessages(prev => {
                    if (prev.find(m => m.id === res.message.id)) return prev;
                    return [...prev, res.message];
                });
            }
        } catch (err) {
            console.error("Failed to send message", err);
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
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
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
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-primary">
                        <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-primary">
                        <Phone className="h-4.5 w-4.5" />
                    </button>
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
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[75%] px-3.5 py-2.5 shadow-sm ${isMe
                                        ? 'bg-primary text-white rounded-2xl rounded-br-sm'
                                        : 'bg-card text-foreground border border-border rounded-2xl rounded-bl-sm'
                                        }`}
                                >
                                    {!isMe && (
                                        <p className="text-primary text-xs font-semibold mb-1">{msg.sender?.name || 'User'}</p>
                                    )}
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
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


            {/* Input Area Container */}

            <div className="shrink-0 bg-card border-t border-border">

                <div className="px-3 py-3 flex items-end gap-2">
                    <div className="flex-1 flex items-end bg-secondary/50 border border-border rounded-2xl px-3 py-2 gap-2 min-h-[44px]">
                        <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5">
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
                        <button className="text-muted-foreground hover:text-foreground transition-colors rotate-[-45deg] pb-0.5">
                            <Paperclip className="h-5 w-5" />
                        </button>
                        {!message && (
                            <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5">
                                <Camera className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleSend}
                        className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-[#ea6c10] transition-colors shadow-md"
                    >
                        {message ? (
                            <Send className="h-4.5 w-4.5 text-white translate-x-0.5" />
                        ) : (
                            <Mic className="h-5 w-5 text-white" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
