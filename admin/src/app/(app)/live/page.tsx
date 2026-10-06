import type { Metadata } from 'next';
import { Badge, DataTable, ErrorState, Forbidden, PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { liveStateSchema, type LiveSession } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { LiveStudio } from './LiveStudio';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.live') };
}

const END_REASONS = ['stopped', 'forced', 'auto', 'failed'] as const;

/** Whole minutes from the start to the end (or to this request, for the one that is live). */
function durationMinutes(s: LiveSession, until = Date.now()): number {
  return Math.max(0, Math.round(((s.endedAt ? new Date(s.endedAt).getTime() : until) - new Date(s.startedAt).getTime()) / 60_000));
}

// Live broadcasting (editor and owner): the camera of this phone or computer, published to Cloudflare Stream from the
// browser, shown on the website's /live page. docs/LIVE.md; the API is server/route/admin/live.js.
// This page has its own Permissions-Policy (camera and microphone allowed, next.config.ts) and Content-Security-Policy
// (connect-src to Cloudflare Stream, src/proxy.ts); the navigation opens it with a full page load for that reason.
export default async function LivePage() {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  if (!can(user.role, 'broadcast')) return <Forbidden />;

  const state = await load(() => serverApi({ path: '/admin/live', schema: liveStateSchema }));
  if (!state.ok) {
    return (
      <>
        <PageHeader title={t('nav.live')} description={t('live.lead')} />
        <ErrorState error={state.error} />
      </>
    );
  }
  const { configured, current, history, maxMinutes } = state.data;
  const ending = (s: LiveSession) =>
    s.status === 'live'
      ? <Badge tone="danger">{t('live.end.live')}</Badge>
      : <Badge tone={s.endReason === 'auto' || s.endReason === 'failed' ? 'warn' : 'neutral'}>{t(`live.end.${(END_REASONS as readonly string[]).includes(s.endReason ?? '') ? (s.endReason as (typeof END_REASONS)[number]) : 'stopped'}`)}</Badge>;

  return (
    <>
      <PageHeader title={t('nav.live')} description={t('live.lead')} />
      <LiveStudio configured={configured} current={current} maxMinutes={maxMinutes} me={{ id: user.id, role: user.role }} />
      <div className="grid">
        <Panel title={t('live.historyTitle')}>
          {history.length === 0 ? (
            <p className="hint">{t('live.historyEmpty')}</p>
          ) : (
            <DataTable
              caption={t('live.historyTitle')}
              rows={history}
              rowKey={(s) => s.id}
              columns={[
                { key: 'title', header: t('live.colTitle'), primary: true, cell: (s) => <span dir="auto">{s.title}</span> },
                { key: 'started', header: t('live.colStarted'), cell: (s) => formatDateTime(s.startedAt, locale) },
                { key: 'duration', header: t('live.colDuration'), align: 'end', cell: (s) => t('live.minutes', { n: durationMinutes(s) }) },
                { key: 'by', header: t('live.colBy'), cell: (s) => <span dir="auto">{s.startedBy.name}</span> },
                { key: 'end', header: t('live.colEnd'), cell: ending },
              ]}
            />
          )}
        </Panel>
        <Panel title={t('live.rulesTitle')}>
          <ul className="rules">
            <li>{t('live.rule1')}</li>
            <li>{t('live.rule2')}</li>
            <li>{t('live.rule3', { hours: Math.round(maxMinutes / 60) })}</li>
            <li>{t('live.rule4')}</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
