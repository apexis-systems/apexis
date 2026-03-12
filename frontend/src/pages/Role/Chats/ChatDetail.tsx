"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Video, Phone, Smile, Paperclip, Camera, Mic, Send, Users, Check, CheckCheck } from 'lucide-react';
import { getRoomMessages, sendChatMessage, markMessageSeen } from '@/services/chatService';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatDetail() {
    const router = useRouter();
    const params = useParams();
    const { socket } = useSocket();
    const { user } = useAuth();

    const role = params?.role as string ?? 'admin';
    const roomId = params?.id as string;

    const [message, setMessage] = useState('');

    if (role === 'superadmin') {
        router.push('/superadmin/dashboard');
        return null;
    }

    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Fetch messages on load
    useEffect(() => {
        const fetchMessages = async () => {
            if (!roomId) return;
            try {
                const data = await getRoomMessages(roomId);
                setMessages(data);

                // Mark unread messages as seen
                data.forEach((msg: any) => {
                    if (!msg.seen && msg.sender_id !== user?.id) {
                        markMessageSeen(msg.id);
                    }
                });
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

        socket.emit('join-room', roomId);

        const handleNewMessage = (msg: any) => {
            if (msg.roomId === roomId) {
                setMessages(prev => [...prev, {
                    ...msg,
                    id: msg.id || Date.now(),
                    sender_id: msg.senderId,
                    sender: { name: msg.senderName }
                }]);

                // Play sound if sender is not me
                if (msg.senderId !== user?.id) {
                    playNotificationSound();
                }

                // Auto-mark as seen if we are in the room
                if (msg.senderId !== user?.id) {
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

        socket.on('new-message', handleNewMessage);
        socket.on('message-seen-update', handleMessageSeen);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-seen-update', handleMessageSeen);
        };
    }, [socket, roomId, user?.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!message.trim() || !roomId) return;

        const tempText = message.trim();
        setMessage('');

        try {
            // 1. Send via API (persists to DB and triggers push notifications)
            const res = await sendChatMessage({
                roomId,
                text: tempText,
                // We'll let the backend determine recipient from roomId for group chats, 
                // or we could pass it here if it's a 1-1 chat.
            });

            // 2. Broadcast via Socket for immediate UI update in others
            if (socket) {
                socket.emit('send-message', {
                    roomId,
                    text: tempText,
                    senderId: user?.id,
                    senderName: user?.name,
                    createdAt: new Date()
                });
            }

            // Local update (optional if socket broadcasts to self, but better for UX)
            // If socket doesn't broadcast to sender, we add it manually.
            // My backend socket.ts uses io.to().emit which includes sender if they are in the room.
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
                <button
                    onClick={() => router.push(`/${role}/chats`)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-[#f97316]"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="w-9 h-9 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">Chat Detail</p>
                    <p className="text-xs text-muted-foreground truncate">Real-time Messaging</p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-[#f97316]">
                        <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-[#f97316]">
                        <Phone className="h-4.5 w-4.5" />
                    </button>
                </div>
            </div>

            {/* Chat Background + Messages */}
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
                                    ? 'bg-[#f97316] text-white rounded-2xl rounded-br-sm'
                                    : 'bg-card text-foreground border border-border rounded-2xl rounded-bl-sm'
                                    }`}
                            >
                                {!isMe && (
                                    <p className="text-[#f97316] text-xs font-semibold mb-1">{msg.sender?.name || 'User'}</p>
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

            {/* Input Area */}
            <div className="bg-card border-t border-border px-3 py-3 flex items-end gap-2 shrink-0">
                <div className="flex-1 flex items-end bg-secondary/50 border border-border rounded-2xl px-3 py-2 gap-2 min-h-[44px]">
                    <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5">
                        <Smile className="h-5 w-5" />
                    </button>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message..."
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-24 py-0.5"
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
                    className="w-11 h-11 rounded-full bg-[#f97316] flex items-center justify-center shrink-0 hover:bg-[#ea6c10] transition-colors shadow-md"
                >
                    {message ? (
                        <Send className="h-4.5 w-4.5 text-white translate-x-0.5" />
                    ) : (
                        <Mic className="h-5 w-5 text-white" />
                    )}
                </button>
            </div>
        </div>
    );
}
