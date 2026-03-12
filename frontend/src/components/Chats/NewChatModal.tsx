"use client";

import { useState, useEffect } from "react";
import { Search, Users, User, X, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrgUsers } from "@/services/userService";
import { createRoom } from "@/services/chatService";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (room: any) => void;
}

export default function NewChatModal({ open, onOpenChange, onSuccess }: Props) {
    const { user: authUser } = useAuth() as any;
    const [type, setType] = useState<'direct' | 'group'>('direct');
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [groupName, setGroupName] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            const fetchUsers = async () => {
                setLoading(true);
                try {
                    const data = await getOrgUsers();
                    // Filter out current user
                    setUsers(data.filter((u: any) => u.id !== authUser?.id && u.role !== 'superadmin'));
                } catch (err) {
                    console.error("Failed to fetch users", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchUsers();
        } else {
            // Reset state
            setSearchQuery("");
            setSelectedUsers([]);
            setGroupName("");
            setType('direct');
        }
    }, [open, authUser?.id]);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUser = (userId: number) => {
        if (type === 'direct') {
            setSelectedUsers([userId]);
        } else {
            setSelectedUsers(prev =>
                prev.includes(userId)
                    ? prev.filter(id => id !== userId)
                    : [...prev, userId]
            );
        }
    };

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;
        if (type === 'group' && !groupName.trim()) return;

        setSubmitting(true);
        try {
            const room = await createRoom({
                type,
                name: type === 'group' ? groupName : undefined,
                memberIds: selectedUsers
            });
            onSuccess(room);
            onOpenChange(false);
        } catch (err) {
            console.error("Failed to create chat", err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle className="text-xl font-bold">New Chat</DialogTitle>
                </DialogHeader>

                <div className="flex border-b">
                    <button
                        onClick={() => { setType('direct'); setSelectedUsers([]); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${type === 'direct' ? 'text-[#f97316] border-b-2 border-[#f97316]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Direct Message
                    </button>
                    <button
                        onClick={() => { setType('group'); setSelectedUsers([]); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${type === 'group' ? 'text-[#f97316] border-b-2 border-[#f97316]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Group Chat
                    </button>
                </div>

                <div className="p-4 bg-secondary/20 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background border-border"
                        />
                    </div>
                </div>

                {type === 'group' && (
                    <div className="p-4 border-b">
                        <Input
                            placeholder="Group Name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="bg-background border-border"
                        />
                    </div>
                )}

                <div className="max-h-[300px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-[#f97316]" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground text-sm">
                            No users found.
                        </div>
                    ) : (
                        filteredUsers.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => toggleUser(u.id)}
                                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-secondary/40 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
                                    <span className="text-white font-bold">{u.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                {selectedUsers.includes(u.id) && (
                                    <div className="w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
                                        <Check className="h-3 w-3 text-white" />
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-secondary/10 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        {selectedUsers.length} selected
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || selectedUsers.length === 0 || (type === 'group' && !groupName.trim())}
                            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Chat'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
