'use client';

import { useRouter } from 'next/navigation';
import Dashboard from '@/views/Dashboard';
import { routeForTab } from '@/lib/routes';

export default function DashboardPage() {
  const router = useRouter();
  return <Dashboard onNavigate={(tab) => router.push(routeForTab(tab))} />;
}
