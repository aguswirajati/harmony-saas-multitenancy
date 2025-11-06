'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

const publicRoutes = ['/login', '/register', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check auth on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const isPublicRoute = publicRoutes.includes(pathname);

    // Redirect to login if not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push('/login');
    }

    // Redirect to dashboard if authenticated and trying to access auth pages
    if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
