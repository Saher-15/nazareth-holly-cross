import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { StateBox } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { ApiError } from '@/lib/api';
import { getSession, load } from '@/lib/server-api';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // An error thrown here would escape this segment's error.tsx (it only wraps the pages) and end on Next's bare
  // error page: a busy API (429) or one that cannot be reached is shown as a normal, translated state instead.
  // An expired session still redirects to /login inside getSession.
  const session = await load(getSession);
  if (!session.ok) return <Unavailable error={session.error} />;
  const { user, expiresAt } = session.data;
  return (
    <AppShell user={{ username: user.username, role: user.role }} expiresAt={expiresAt}>
      {children}
    </AppShell>
  );
}

async function Unavailable({ error }: { error: ApiError }) {
  const { t } = await getI18n();
  const minutes = error.status === 429 ? Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)) : null;
  return (
    <main id="main" className="login" tabIndex={-1}>
      <div className="login__card">
        <StateBox
          icon="alert"
          tone="error"
          title={t('state.error')}
          text={minutes !== null ? t('state.rateLimitedMinutes', { minutes }) : t('state.errorText')}
          action={
            <a className="btn btn--ghost btn--sm" href="">
              {t('common.retry')}
            </a>
          }
        />
      </div>
    </main>
  );
}
