'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (user) {
      const isSuperAdmin = user.role === 'super_admin';
      const isOnAdminPath = pathname.startsWith('/admin');
      const isOnDashboardPath = pathname.startsWith('/dashboard') || pathname === '/';

      if (isSuperAdmin && !isOnAdminPath) {
        router.replace('/admin');
      } else if (!isSuperAdmin && isOnAdminPath) {
        router.replace('/dashboard');
      }
    }
  }, [user, pathname, router, isAuthenticated]);

  return <>{children}</>;
}