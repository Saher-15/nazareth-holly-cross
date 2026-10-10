import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { Badge, DataTable, EmptyState, ErrorState, Forbidden, PageHeader, Pagination, type Tone } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';
import { auditPage, parseListParams, type AuditEntry } from '@/lib/api';
import { AUDIT_GROUPS, auditDetails, auditHref, auditLabel, auditTarget } from '@/lib/audit-labels';
import { formatDateTime, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { one } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.audit') };
}

// The tone of an action. The live actions use "_" inside the name (live.recording_delete, live.schedule_create,
// live.recording_failed): they get the same tones.
function toneOf(action: string): Tone {
  if (action.includes('failed')) return 'danger';
  if (/[._]delete$/.test(action) || action.includes('disable')) return 'warn';
  if (action.startsWith('auth.') || action.startsWith('totp')) return 'info';
  if (/[._]create$/.test(action)) return 'success';
  return 'neutral';
}

// Who did what (review 04 finding 13): each action in words with its code beside it (lib/audit-labels.ts), the target
// named and linked when it still exists, a few facts from the entry (e-mail sent, role, rows), filtered by a user name
// and by a kind of action.
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
  const groups: string[] = [...AUDIT_GROUPS];
  if (action && !groups.includes(action)) groups.push(action); // an exact action from a link keeps its own option

  return (
    <>
      <PageHeader title={t('nav.audit')} description={t('audit.lead')} />
      <Form className="toolbar" action="/audit" prefetch={false} role="search" aria-label={t('audit.filters')}>
        {params.size !== 25 ? <input type="hidden" name="size" value={params.size} /> : null}
        <div className="toolbar__search">
          <label className="visually-hidden" htmlFor="actor">{t('audit.actor')}</label>
          <Icon name="profile" size={18} />
          <input id="actor" name="actor" type="search" className="input" defaultValue={actor} placeholder={t('audit.actor')} maxLength={60} autoComplete="off" />
        </div>
        <div className="toolbar__select">
          <label className="visually-hidden" htmlFor="action">{t('audit.action')}</label>
          <select id="action" name="action" className="select" defaultValue={action}>
            <option value="">{t('audit.allActions')}</option>
            {groups.map((g) => (
              <option key={g} value={g}>{groupLabel(t, g)}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn--gold btn--sm">{t('common.apply')}</button>
        {actor || action ? <Link className="btn btn--ghost btn--sm" href="/audit">{t('common.reset')}</Link> : null}
      </Form>

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
              { key: 'actor', header: t('audit.actor'), cell: (e) => <span className="strong"><bdi>{e.actorName || '-'}</bdi></span> },
              {
                key: 'action',
                header: t('audit.action'),
                cell: (e) => {
                  const label = auditLabel(e, t);
                  return (
                    <>
                      <Badge tone={toneOf(e.action)}>{label ?? <bdi className="ltr">{e.action}</bdi>}</Badge>
                      {label ? <span className="cell-sub"><code className="code">{e.action}</code></span> : null}
                    </>
                  );
                },
              },
              {
                key: 'target',
                header: t('audit.target'),
                className: 'cell-wide',
                cell: (e) => {
                  const target = auditTarget(e, t);
                  const href = auditHref(e);
                  const details = auditDetails(e, t);
                  const shown = target ?? (e.targetText ? truncate(e.targetText, 60) : null);
                  return (
                    <>
                      {shown ? href ? <Link className="link" href={href}><bdi>{shown}</bdi></Link> : <bdi>{shown}</bdi> : '-'}
                      {details.length ? <span className="cell-sub">{details.join(' · ')}</span> : null}
                    </>
                  );
                },
              },
              { key: 'ua', header: t('audit.device'), cell: (e) => (!e.userAgent || /^unknown$/i.test(e.userAgent) ? t('audit.unknownDevice') : <bdi className="ltr">{e.userAgent}</bdi>) },
              { key: 'ip', header: t('audit.ip'), cell: (e) => (e.ipHash ? <code className="code">{e.ipHash.slice(0, 10)}</code> : '-') },
            ]}
          />
          <Pagination base="/audit" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
          <p className="hint">{t('audit.retention')}</p>
        </>
      )}
    </>
  );
}

/** "Orders (order.)": the kind of action in words, its prefix beside it. */
function groupLabel(t: Awaited<ReturnType<typeof getI18n>>['t'], prefix: string): string {
  const keys: Record<string, Parameters<typeof t>[0]> = {
    'auth.': 'audit.g.auth', 'order.': 'audit.g.order', 'payment.': 'audit.g.payment', 'candle.': 'audit.g.candle', 'contact.': 'audit.g.contact',
    'product.': 'audit.g.product', 'site-review.': 'audit.g.siteReview', 'product-review.': 'audit.g.productReview', 'prayer.': 'audit.g.prayer',
    'user.': 'audit.g.user', 'export.': 'audit.g.export', 'privacy.': 'audit.g.privacy', 'live.': 'audit.g.live',
    'candle_video.': 'audit.g.candleVideo', 'settings.': 'audit.g.settings',
  };
  return keys[prefix] ? `${t(keys[prefix])} (${prefix})` : prefix;
}
