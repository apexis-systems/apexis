"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Search, PlusCircle, Camera, Users, MessageSquare } from 'lucide-react';
import { listRooms } from '@/services/chatService';
import NewChatModal from '@/components/Chats/NewChatModal';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

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
                const roomIndex = prevRooms.findIndex(r => r.id === data.room_id);
                if (roomIndex === -1) {
                    fetchRooms();
                    return prevRooms;
                }

                const updatedRooms = [...prevRooms];
                const room = { ...updatedRooms[roomIndex] };
                room.chat_messages = [data.message];
                room.updatedAt = new Date().toISOString();

                updatedRooms.splice(roomIndex, 1);
                updatedRooms.unshift(room);
                return updatedRooms;
            });
        });

        socket.on('user-status-changed', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(userId);
                else next.delete(userId);
                return next;
            });
        });

        // Request current status for room members
        rooms.forEach((room: any) => {
            room.room_members?.forEach((m: any) => {
                if (m.user?.id && m.user.id !== authUser?.id) {
                    socket.emit('check-user-status', m.user.id);
                }
            });
        });

        socket.on('user-status-response', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(userId);
                else next.delete(userId);
                return next;
            });
        });

        return () => {
            socket.off('new-message-global');
            socket.off('user-status-changed');
            socket.off('user-status-response');
        };
    }, [socket, !!rooms.length, authUser?.id]);

    const filtered = rooms.filter(c =>
        (c.name || c.room_members?.[0]?.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                        <MessageSquare className="h-12 w-12 opacity-30" />
                        <p className="text-sm">No chats found</p>
                    </div>
                ) : (
                    filtered.map((chat, idx) => {
                        const isGroup = chat.type === 'group';
                        const otherMember = chat.room_members?.find((m: any) => m.user?.id !== authUser?.id);
                        const displayName = chat.name || otherMember?.user?.name || 'Chat';
                        const isOnline = otherMember?.user?.id && onlineUsers.has(otherMember.user.id);
                        const profilePic = otherMember?.user?.profile_pic;
                        const avatarUrl = profilePic
                            ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/uploads/${profilePic}`
                            : null;

                        return (
                            <button
                                key={chat.id}
                                onClick={() => router.push(`/${role}/chats/${chat.id}`)}
                                className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left ${idx < filtered.length - 1 ? 'border-b border-border' : ''}`}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    {isGroup ? (
                                        <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center">
                                            <Users className="h-5 w-5 text-white" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-bold">{displayName.charAt(0)}</span>
                                            )}
                                        </div>
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
                                        <p className="text-xs truncate text-muted-foreground">
                                            {chat.chat_messages?.[0]?.text || (chat.type === 'group' ? 'Group Chat' : 'Direct Message')}
                                        </p>
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
