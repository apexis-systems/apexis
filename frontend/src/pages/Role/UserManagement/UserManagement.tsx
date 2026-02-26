"use client";

import { useState } from 'react';
import { mockAllUsers } from '@/data/mock';
import { User, UserRole } from '@/types';
import { UserPlus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

const UserManagement = () => {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([...mockAllUsers]);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('contributor');

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <div className="p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    const toggleActive = (id: string) => {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
        toast.success('User status updated');
    };

    const changeRole = (id: string, role: UserRole) => {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
        toast.success('Role updated');
    };

    const removeUser = (id: string) => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success('User removed');
    };

    const addUser = () => {
        if (!newName.trim() || !newEmail.trim()) { toast.error('Name and email required'); return; }
        const newUser: User = { id: `u-${Date.now()}`, name: newName.trim(), email: newEmail.trim(), role: newRole, active: true };
        setUsers((prev) => [...prev, newUser]);
        setNewName(''); setNewEmail(''); setNewRole('contributor'); setShowAdd(false);
        toast.success('User added');
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">{t('user_mgmt')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{users.length} users total</p>
                </div>
                <Button onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <UserPlus className="h-4 w-4 mr-2" /> Add User
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-secondary/50">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                                <td className="px-4 py-3">
                                    <Select value={u.role} onValueChange={(val) => changeRole(u.id, val as UserRole)}>
                                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="contributor">Contributor</SelectItem>
                                            <SelectItem value="client">Client</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => toggleActive(u.id)} className="flex items-center gap-1.5">
                                        {u.active ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                                        <span className={cn('text-xs font-medium', u.active ? 'text-accent' : 'text-muted-foreground')}>
                                            {u.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => removeUser(u.id)} className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@example.com" type="email" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="contributor">Contributor</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button onClick={addUser} className="bg-accent text-accent-foreground hover:bg-accent/90">Add User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagement;
