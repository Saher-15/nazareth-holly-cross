import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { getSession } from '@/lib/server-api';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, expiresAt } = await getSession();
  return (
    <AppShell user={{ username: user.username, role: user.role }} expiresAt={expiresAt}>
      {children}
    </AppShell>
  );
}
