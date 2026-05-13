"use client";

import { useState, useEffect } from "react";
import { Search, Users, User, X, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChatUsers } from "@/services/userService";
import { createRoom } from "@/services/chatService";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (room: any) => void;
}

export default function NewChatModal({ open, onOpenChange, onSuccess }: Props) {
    const { user: authUser } = useAuth() as any;
    const { t } = useLanguage();
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
                    const data = await getChatUsers();
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
        (u.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (u.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
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
        if (type === 'group' && !groupName.trim()) {
            alert(t('enter_group_name'));
            return;
        }

        setSubmitting(true);
        try {
            const room = await createRoom({
                type,
                name: type === 'group' ? groupName : undefined,
                memberIds: selectedUsers
            });
            onSuccess(room);
            onOpenChange(false);
        } catch (err: any) {
            console.error("Failed to create chat", err);
            alert(err?.response?.data?.error || err.message || t('failed_create_chat'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-4 border-b space-y-0">
                    <DialogTitle className="text-xl font-bold">
                        {type === 'group' ? t('new_group') : t('new_direct_chat')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex border-b">
                    <button
                        onClick={() => { setType('direct'); setSelectedUsers([]); }}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${type === 'direct' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {t('direct_message')}
                    </button>
                    {(authUser?.role === 'admin' || authUser?.role === 'contributor') && (
                        <button
                            onClick={() => { setType('group'); setSelectedUsers([]); }}
                            className={`flex-1 py-3 text-sm font-semibold transition-colors ${type === 'group' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t('group_chat')}
                        </button>
                    )}
                </div>

                <div className="p-4 bg-secondary/20 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('search_people')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background border-border"
                        />
                    </div>
                </div>

                {type === 'group' && (
                    <div className="p-4 border-b">
                        <Input
                            placeholder={t('group_name_placeholder')}
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="bg-background border-border"
                        />
                    </div>
                )}

                <div className="max-h-[300px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground text-sm">
                            {t('no_users_found')}
                        </div>
                    ) : (
                        filteredUsers.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => toggleUser(u.id)}
                                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-secondary/40 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <span className="text-white font-bold">{u.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                                        {u.organization?.name && (
                                            <span className="px-1.5 py-0.5 bg-muted rounded text-[7px] font-bold text-muted-foreground uppercase">
                                                {u.organization.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {u.project_members && u.project_members.length > 0 ? (
                                            u.project_members.slice(0, 2).map((pm: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[7px] font-extrabold uppercase text-accent bg-accent/5 px-1 py-0.5 rounded border border-accent/10 shrink-0">
                                                        {pm.role}
                                                    </span>
                                                    <span className="text-[8px] text-muted-foreground truncate font-medium">
                                                        {pm.project?.name}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-[8px] font-extrabold uppercase text-accent bg-accent/5 px-1.5 py-0.5 rounded border border-accent/10 shrink-0">
                                                {u.role}
                                            </span>
                                        )}
                                        {u.project_members && u.project_members.length > 2 && (
                                            <span className="text-[7px] text-muted-foreground font-bold mt-0.5">
                                                {t('more_projects').replace('{count}', (u.project_members.length - 2).toString())}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {selectedUsers.includes(u.id) && (
                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                        <Check className="h-3 w-3 text-white" />
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-secondary/10 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        {t('users_selected').replace('{count}', selectedUsers.length.toString())}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            {t('cancel')}
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || selectedUsers.length === 0}
                            className="bg-primary hover:bg-primary/90 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : type === 'group' ? (
                                t('create_group_btn').replace('{count}', selectedUsers.length.toString())
                            ) : (
                                t('create_chat_btn')
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
