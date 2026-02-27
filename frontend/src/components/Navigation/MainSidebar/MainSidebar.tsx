"use client";

import { Home, Upload, Clock, User, Users, AlertTriangle, CreditCard, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserRole } from '@/types';

const MainSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, switchRole, logout } = useAuth() || {};
  const { t } = useLanguage();

  const basePath = `/${user?.role || 'admin'}`;

  const navItems = [
    { icon: Home, label: t('dashboard'), path: `${basePath}/dashboard` },
    { icon: Upload, label: t('upload'), path: `${basePath}/upload` },
    { icon: Clock, label: t('activity'), path: `${basePath}/activity` },
    { icon: AlertTriangle, label: t('snag_list'), path: `${basePath}/snags` },
    { icon: User, label: t('profile'), path: `${basePath}/profile` },
    ...((user?.role === 'admin' || user?.role === 'superadmin') ? [
      { icon: Users, label: t('user_mgmt'), path: `${basePath}/users` },
      { icon: CreditCard, label: t('billing'), path: `${basePath}/billing` },
    ] : []),
  ];

  const roles: { value: UserRole; label: string }[] = [
    { value: 'superadmin', label: 'Super Admin' },
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
                onClick={() => {
                  switchRole(role.value);
                  router.push(`/${role.value}/dashboard`);
                }}
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

      {/* Logout Button */}
      {logout && (
        <div className="border-t border-border p-3">
          <button
            onClick={() => {
              logout();
              router.push('/'); // the middleware handles redirecting to login
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-red-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {t('logout') || 'Logout'}
          </button>
        </div>
      )}
    </aside>
  );
};

export default MainSidebar;
