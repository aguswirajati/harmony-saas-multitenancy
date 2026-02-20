'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/lib/store/authStore';

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = useAuthStore();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar variant="dashboard" tenantName={tenant?.name} />
        <SidebarInset>
          <TopNavBar variant="dashboard" tenantName={tenant?.name} />
          <EmailVerificationBanner />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
