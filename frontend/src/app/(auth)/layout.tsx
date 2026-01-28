'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checkAuth, isAuthenticated } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth();
    setAuthChecked(true);
  }, [checkAuth]);

  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (user) {
      const isSuperAdmin = user.role === 'super_admin';
      const isOnAdminPath = pathname.startsWith('/admin');

      if (isSuperAdmin && !isOnAdminPath) {
        router.replace('/admin');
      } else if (!isSuperAdmin && isOnAdminPath) {
        router.replace('/dashboard');
      }
    }
  }, [user, pathname, router, isAuthenticated, authChecked]);

  // Don't render anything until auth state is resolved
  if (!authChecked || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}