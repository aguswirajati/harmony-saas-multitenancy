// Force dynamic rendering to skip static generation for all dashboard pages
export const dynamic = 'force-dynamic';

import DashboardLayoutClient from './DashboardLayoutClient';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
