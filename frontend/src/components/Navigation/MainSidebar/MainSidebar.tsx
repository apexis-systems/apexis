"use client";

import { Home, Upload, Clock, User, Users, AlertTriangle, CreditCard } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
// import { UserRole } from '@/types';
type UserRole = 'admin' | 'contributor' | 'client';

const MainSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, switchRole } = useAuth() || {};

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Upload, label: 'Upload', path: '/dashboard/upload' },
    { icon: Clock, label: 'Activity', path: '/dashboard/activity' },
    { icon: AlertTriangle, label: 'Snag List', path: '/dashboard/snags' },
    { icon: User, label: 'Profile', path: '/dashboard/profile' },
    ...(user?.role === 'admin' ? [
      { icon: Users, label: 'User Mgmt', path: '/dashboard/users' },
      { icon: CreditCard, label: 'Billing', path: '/dashboard/billing' },
    ] : []),
  ];

  const roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'client', label: 'Client' },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card min-h-[calc(100vh-3.5rem)] flex flex-col">
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {user && switchRole && (
        <div className="border-t border-border p-3">
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Demo Role</p>
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.value}
                onClick={() => switchRole(role.value)}
                className={cn(
                  'w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-left',
                  user.role === role.value
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default MainSidebar;
