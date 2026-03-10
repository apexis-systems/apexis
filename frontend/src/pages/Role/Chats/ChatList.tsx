"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Search, PlusCircle, Camera, Users, MessageSquare } from 'lucide-react';

const MOCK_CHATS = [
    {
        id: '1',
        name: 'Alpha Tower Team',
        type: 'group',
        lastMessage: 'Admin added Sarah (Client) recently.',
        time: '12:45 PM',
        unread: 2,
        isSystem: true,
        participants: 5,
        avatar: null,
    },
    {
        id: '2',
        name: 'Sarah Jenkins',
        type: 'direct',
        lastMessage: 'Yes, the inspection is scheduled for tomorrow.',
        time: 'Yesterday',
        unread: 0,
        isSystem: false,
        role: 'Client',
        avatar: 'https://i.pravatar.cc/150?u=sarah',
    },
    {
        id: '3',
        name: 'Site Managers',
        type: 'group',
        lastMessage: 'Michael joined using invite code X7B9.',
        time: 'Monday',
        unread: 0,
        isSystem: true,
        participants: 3,
        avatar: null,
    },
    {
        id: '4',
        name: 'David Chen',
        type: 'direct',
        lastMessage: 'Can you upload the latest drawings?',
        time: 'Monday',
        unread: 0,
        isSystem: false,
        role: 'Contributor',
        avatar: 'https://i.pravatar.cc/150?u=david',
    },
];

export default function ChatList() {
    const router = useRouter();
    const params = useParams();
    const role = params?.role as string ?? 'admin';
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = MOCK_CHATS.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">Chats</h1>
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Camera className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
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
                    filtered.map((chat, idx) => (
                        <button
                            key={chat.id}
                            onClick={() => router.push(`/${role}/chats/${chat.id}`)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left ${idx < filtered.length - 1 ? 'border-b border-border' : ''}`}
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                {chat.type === 'group' ? (
                                    <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center">
                                        <Users className="h-5 w-5 text-white" />
                                    </div>
                                ) : (
                                    <img
                                        src={chat.avatar || 'https://i.pravatar.cc/150'}
                                        alt={chat.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                )}
                                {chat.unread > 0 && (
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-card" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-semibold text-foreground text-sm truncate">{chat.name}</span>
                                    <span className={`text-xs shrink-0 ml-2 ${chat.unread > 0 ? 'text-[#25D366]' : 'text-muted-foreground'}`}>
                                        {chat.time}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <p className={`text-xs truncate ${chat.isSystem ? 'text-[#f97316] italic' : 'text-muted-foreground'}`}>
                                        {chat.lastMessage}
                                    </p>
                                    {chat.unread > 0 && (
                                        <span className="shrink-0 bg-[#25D366] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                                            {chat.unread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
