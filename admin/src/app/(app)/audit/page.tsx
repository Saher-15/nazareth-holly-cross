import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, DataTable, EmptyState, ErrorState, Forbidden, PageHeader, Pagination, type Tone } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';
import { auditPage, parseListParams, type AuditEntry } from '@/lib/api';
import { formatDateTime, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { one } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.audit') };
}

// Action names are shown as they are (Latin, .ltr); only their tone is chosen. The live actions use "_" inside the
// name (live.recording_delete, live.schedule_create, live.recording_failed): they get the same tones.
function toneOf(action: string): Tone {
  if (action.includes('failed')) return 'danger';
  if (/[._]delete$/.test(action) || action.includes('disable')) return 'warn';
  if (action.startsWith('auth.') || action.startsWith('totp')) return 'info';
  if (/[._]create$/.test(action)) return 'success';
  return 'neutral';
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  if (!can(user.role, 'viewAudit')) return <Forbidden />;
  const raw = await searchParams;
  const params = parseListParams(raw, { size: 50 });
  const actor = (one(raw, 'actor') ?? '').slice(0, 60);
  const action = (one(raw, 'action') ?? '').slice(0, 60);
  const keep = { page: params.page > 1 ? params.page : undefined, size: params.size !== 25 ? params.size : undefined, actor: actor || undefined, action: action || undefined };
  const list = await load(() => serverApi({ path: '/admin/audit', query: { page: params.page, size: params.size, actor, action }, schema: auditPage }));

  return (
    <>
      <PageHeader title={t('nav.audit')} description={t('audit.lead')} />
      <form className="toolbar" method="get" action="/audit" role="search" aria-label={t('audit.filters')}>
        {params.size !== 25 ? <input type="hidden" name="size" value={params.size} /> : null}
        <div className="toolbar__search">
          <label className="visually-hidden" htmlFor="actor">{t('audit.actor')}</label>
          <Icon name="profile" size={18} />
          <input id="actor" name="actor" type="search" className="input" defaultValue={actor} placeholder={t('audit.actor')} maxLength={60} autoComplete="off" />
        </div>
        <div className="toolbar__search">
          <label className="visually-hidden" htmlFor="action">{t('audit.action')}</label>
          <Icon name="search" size={18} />
          <input id="action" name="action" type="search" className="input" defaultValue={action} placeholder={t('audit.actionPlaceholder')} maxLength={60} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn--gold btn--sm">{t('common.apply')}</button>
        {actor || action ? <Link className="btn btn--ghost btn--sm" href="/audit">{t('common.reset')}</Link> : null}
      </form>

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={actor || action ? t('state.noResults') : t('audit.empty')} text={actor || action ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<AuditEntry>
            caption={t('nav.audit')}
            rows={list.data.items}
            rowKey={(e) => e.id}
            columns={[
              { key: 'when', header: t('audit.when'), primary: true, cell: (e) => formatDateTime(e.when, locale) },
              { key: 'actor', header: t('audit.actor'), cell: (e) => <span className="strong">{e.actorName || '-'}</span> },
              { key: 'action', header: t('audit.action'), cell: (e) => <Badge tone={toneOf(e.action)}><bdi className="ltr">{e.action}</bdi></Badge> },
              { key: 'target', header: t('audit.target'), className: 'cell-wide', cell: (e) => (e.targetText ? <bdi className="ltr">{truncate(e.targetText, 60)}</bdi> : '-') },
              { key: 'ip', header: t('audit.ip'), cell: (e) => (e.ipHash ? <code className="code">{e.ipHash.slice(0, 10)}</code> : '-') },
              { key: 'ua', header: t('audit.device'), cell: (e) => e.userAgent ?? '-' },
            ]}
          />
          <Pagination base="/audit" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
          <p className="hint">{t('audit.retention')}</p>
        </>
      )}
    </>
  );
}
