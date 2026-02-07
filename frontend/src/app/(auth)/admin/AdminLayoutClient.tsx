'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { useDevModeStore } from '@/lib/store/devModeStore';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Shield,
  Database,
  Wrench,
  Crown,
  Bug
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Link from 'next/link';
import { useState } from 'react';

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, logout } = useAuthStore();
  const { devMode, toggleDevMode } = useDevModeStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const baseNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Tenants', href: '/admin/tenants', icon: Building2 },
    { name: 'All Users', href: '/admin/users', icon: Users },
    { name: 'Subscriptions', href: '/admin/subscriptions', icon: Crown },
    { name: 'Audit Logs', href: '/admin/logs', icon: Shield },
    { name: 'Statistics', href: '/admin/stats', icon: TrendingUp },
  ];

  const devNavigation = [
    { name: 'Developer Tools', href: '/admin/tools', icon: Wrench },
  ];

  const navigation = devMode ? [...baseNavigation, ...devNavigation] : baseNavigation;

  const isActiveLink = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    // For other routes, check if pathname starts with href
    // but also ensure it's not just a prefix of another route
    if (pathname === href) {
      return true;
    }
    // Check if it's a child route (pathname starts with href + /)
    return pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-linear-to-r from-purple-600 to-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-white/10"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center space-x-2">
            <Shield size={20} />
            <h1 className="text-lg font-bold">Super Admin</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-white hover:bg-white/10"
        >
          <LogOut size={18} />
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-linear-to-r from-purple-900 via-purple-800 to-blue-900 text-white
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">Super Admin</h1>
                <p className="text-xs text-purple-200">System Management</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const active = isActiveLink(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all
                    ${active
                      ? 'bg-white/20 text-white font-medium shadow-lg'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* System Info & Dev Mode Toggle */}
          <div className="p-4 border-t border-white/10 bg-black/10 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-purple-200">
              <Database size={14} />
              <span>System Status: Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-purple-200">
                <Bug size={14} />
                <span>Dev Mode</span>
              </div>
              <Switch
                checked={devMode}
                onCheckedChange={toggleDevMode}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>

          {/* User info */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-white font-semibold shadow-lg">
                {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-purple-200 truncate flex items-center space-x-1">
                  <Shield size={12} />
                  <span>{user?.role}</span>
                </p>
              </div>
              <ThemeToggle className="text-white hover:bg-white/10" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="pt-16 lg:pt-0">
          <main className="min-h-screen">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
