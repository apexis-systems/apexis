"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Search, PlusCircle, Camera, Users, MessageSquare } from 'lucide-react';
import { listRooms } from '@/services/chatService';
import NewChatModal from '@/components/Chats/NewChatModal';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import SecureAvatar from '@/components/shared/SecureAvatar';

export default function ChatList() {
    const router = useRouter();
    const params = useParams();
    const role = params?.role as string ?? 'admin';
    const { socket } = useSocket();
    const { user: authUser } = useAuth() as any;
    const [searchQuery, setSearchQuery] = useState('');
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<number | string>>(new Set());
    const [typingRooms, setTypingRooms] = useState<Record<string, string>>({});
    const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});


    if (role === 'superadmin') {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
                <p className="text-muted-foreground">Superadmins do not have access to the chat feature.</p>
                <button
                    onClick={() => router.push('/superadmin/dashboard')}
                    className="mt-6 px-4 py-2 bg-accent text-white rounded-lg font-medium"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const fetchRooms = async () => {
        try {
            const data = await listRooms();
            setRooms(data);
        } catch (err) {
            console.error("Failed to fetch rooms", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('new-message-global', (data: any) => {
            setRooms(prevRooms => {
                const roomIndex = prevRooms.findIndex(r => String(r.id) === String(data.room_id));
                if (roomIndex === -1) {
                    fetchRooms();
                    return prevRooms;
                }

                const updatedRooms = [...prevRooms];
                const room = { ...updatedRooms[roomIndex] };
                room.chat_messages = [data.message];
                room.updatedAt = data.message.createdAt || new Date().toISOString();

                // Increment unread count if it exists, otherwise start at 1
                // We only increment if the message is from someone else
                if (data.message.sender_id !== authUser?.id) {
                    room.unread_count = (Number(room.unread_count) || 0) + 1;
                }

                updatedRooms.splice(roomIndex, 1);
                updatedRooms.unshift(room);
                return updatedRooms;
            });
        });

        socket.on('user-status-changed', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(String(userId));
                else next.delete(String(userId));
                return next;
            });
        });

        // Request current status for room members and join rooms
        rooms.forEach((room: any) => {
            // Join room for real-time updates like typing
            socket.emit('join-room', room.id);

            room.room_members?.forEach((m: any) => {
                if (m.user?.id && m.user.id !== authUser?.id) {
                    socket.emit('check-user-status', m.user.id);
                }
            });
        });

        const handleTyping = ({ roomId, userName }: { roomId: string | number, userName: string }) => {
            const rid = String(roomId);
            setTypingRooms(prev => ({ ...prev, [rid]: userName }));

            if (typingTimeoutsRef.current[rid]) clearTimeout(typingTimeoutsRef.current[rid]);
            typingTimeoutsRef.current[rid] = setTimeout(() => {
                setTypingRooms(prev => {
                    const next = { ...prev };
                    delete next[rid];
                    return next;
                });
            }, 3000);
        };

        socket.on('user-status-response', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(String(userId));
                else next.delete(String(userId));
                return next;
            });
        });

        socket.on('user-typing', handleTyping);

        return () => {
            socket.off('new-message-global');
            socket.off('user-status-changed');
            socket.off('user-status-response');
            socket.off('user-typing');
            // Cleanup timeouts
            Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
        };
    }, [socket, rooms.length, authUser?.id]);

    const sorted = [...rooms]
        .filter(c =>
            (c.name || c.room_members?.[0]?.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
        });

    if (loading) return <div className="p-6 text-center text-muted-foreground">Loading chats...</div>;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">Chats</h1>
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Camera className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                        <PlusCircle className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 mb-4">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search chats..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
            </div>

            {/* Chat List */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                        <MessageSquare className="h-12 w-12 opacity-30" />
                        <p className="text-sm">No chats found</p>
                    </div>
                ) : (
                    sorted.map((chat, idx) => {
                        const isGroup = chat.type === 'group';
                        const otherMember = chat.room_members?.find((m: any) => String(m.user?.id) !== String(authUser?.id));
                        const displayName = chat.name || otherMember?.user?.name || 'Chat';
                        const isOnline = otherMember?.user?.id && onlineUsers.has(String(otherMember.user.id));
                        const displayAvatarKey = otherMember?.user?.profile_pic;

                        return (
                            <button
                                key={chat.id}
                                onClick={() => {
                                    setRooms(prev => prev.map(r => String(r.id) === String(chat.id) ? { ...r, unread_count: 0 } : r));
                                    router.push(`/${role}/chats/${chat.id}`);
                                }}
                                className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left ${idx < sorted.length - 1 ? 'border-b border-border' : ''}`}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    {isGroup ? (
                                        <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center">
                                            <Users className="h-5 w-5 text-white" />
                                        </div>
                                    ) : (
                                        <SecureAvatar
                                            fileKey={displayAvatarKey}
                                            name={displayName}
                                            size="h-12 w-12"
                                        />
                                    )}
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-semibold text-foreground text-sm truncate">{displayName}</span>
                                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                            {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        {typingRooms[String(chat.id)] ? (
                                            <p className="text-xs truncate text-[#f97316] italic font-medium animate-pulse">
                                                {typingRooms[String(chat.id)]} is typing...
                                            </p>
                                        ) : (
                                            <p className="text-xs truncate text-muted-foreground">
                                                {chat.chat_messages?.[0]?.text || (chat.type === 'group' ? 'Group Chat' : 'Direct Message')}
                                            </p>
                                        )}
                                        {chat.unread_count > 0 && (
                                            <div className="h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-white leading-none">
                                                    {chat.unread_count}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            <NewChatModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onSuccess={(newRoom) => router.push(`/${role}/chats/${newRoom.id}`)}
            />
        </div>
    );
}
