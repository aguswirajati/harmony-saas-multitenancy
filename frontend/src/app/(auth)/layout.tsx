'use client';

import { ReactNode, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

// For hydration-safe mounting
const emptySubscribe = () => () => {};

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checkAuth, isAuthenticated } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  // Hydration-safe mounting check
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Combined auth check logic
  const performAuthCheck = useCallback(() => {
    checkAuth();
    return true;
  }, [checkAuth]);

  useEffect(() => {
    if (!mounted) return;
    const checked = performAuthCheck();
    if (checked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for hydration-safe auth check
      setAuthChecked(true);
    }
  }, [mounted, performAuthCheck]);

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
