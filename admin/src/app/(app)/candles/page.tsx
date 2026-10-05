import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Drawer } from '@/components/ui/Drawer';
import { Badge, DataTable, EmptyState, ErrorState, Field, hrefWith, ListToolbar, Ltr, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { candleSchema, candlesPage, parseListParams, type Candle } from '@/lib/api';
import { formatDateTime, fullName, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { openParam } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.candles') };
}

const DEFAULT_SORT = '-createdAt';

export default async function CandlesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const open = openParam(raw);
  const keep = paramsOf(params, DEFAULT_SORT);
  const canWrite = can(user.role, 'write');

  const [list, detail] = await Promise.all([
    load(() => serverApi({ path: '/admin/candles', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: candlesPage })),
    open ? load(() => serverApi({ path: `/admin/candles/${open}`, schema: candleSchema })) : Promise.resolve(null),
  ]);
  const closeHref = hrefWith('/candles', keep);

  return (
    <>
      <PageHeader title={t('nav.candles')} description={t('candles.lead')} />
      <ListToolbar
        action="/candles"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'pending', label: t('status.pending') },
          { value: 'done', label: t('status.done') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
        ]}
        exportPath="/api/proxy/export/candles.csv"
        searchLabel={t('candles.search')}
      />

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={params.q || params.status ? t('state.noResults') : t('candles.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<Candle>
            caption={t('nav.candles')}
            rows={list.data.items}
            rowKey={(c) => c.id}
            columns={[
              {
                key: 'who',
                header: t('candles.colRequester'),
                primary: true,
                cell: (c) => (
                  <>
                    <Link className="link link--strong" href={hrefWith('/candles', { ...keep, open: c.id })} scroll={false}>{fullName(c.firstName, c.lastName)}</Link>
                    <span className="cell-sub"><Ltr>{c.email}</Ltr></span>
                  </>
                ),
              },
              { key: 'prayer', header: t('candles.colPrayer'), className: 'cell-wide', cell: (c) => truncate(c.prayer, 110) },
              { key: 'date', header: t('common.date'), cell: (c) => formatDateTime(c.createdAt, locale) },
              { key: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.done ? 'success' : 'gold'}>{c.done ? t('status.done') : t('status.pending')}</Badge> },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (c) => (
                  <div className="row-actions">
                    <Link className="btn btn--ghost btn--sm" href={hrefWith('/candles', { ...keep, open: c.id })} scroll={false}>{t('common.view')}</Link>
                    {canWrite && !c.done ? (
                      <ApiAction label={t('common.markDone')} ariaLabel={t('candles.markDoneFor', { name: fullName(c.firstName, c.lastName) })} icon="check" method="PATCH" path={`candles/${c.id}`} body={{ done: true }} tone="gold" successText={t('candles.doneToast')} />
                    ) : null}
                    {canWrite ? (
                      <ApiAction
                        label={t('common.delete')}
                        ariaLabel={t('candles.deleteFor', { name: fullName(c.firstName, c.lastName) })}
                        icon="trash"
                        iconOnly
                        tone="danger"
                        method="DELETE"
                        path={`candles/${c.id}`}
                        successText={t('candles.deletedToast')}
                        confirm={{ title: t('candles.confirmDeleteTitle'), message: t('candles.confirmDeleteText', { name: fullName(c.firstName, c.lastName) }), confirmLabel: t('common.delete') }}
                      />
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination base="/candles" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}

      {open ? (
        <Drawer title={t('candles.detailTitle')} closeHref={closeHref}>
          {detail && detail.ok ? (
            <>
              <div className="detail-head">
                <div>
                  <p className="detail-head__id">{fullName(detail.data.firstName, detail.data.lastName)}</p>
                  <p className="muted">{formatDateTime(detail.data.createdAt, locale)}</p>
                </div>
                <Badge tone={detail.data.done ? 'success' : 'gold'}>{detail.data.done ? t('status.done') : t('status.pending')}</Badge>
              </div>
              <dl className="fields">
                <Field label={t('common.email')}><a className="link" href={`mailto:${detail.data.email}`}><Ltr>{detail.data.email}</Ltr></a></Field>
                <Field label={t('candles.colPrayer')} wide><p className="prose">{detail.data.prayer}</p></Field>
              </dl>
              {canWrite ? (
                <div className="drawer__actions">
                  {!detail.data.done ? (
                    <ApiAction label={t('common.markDone')} icon="check" method="PATCH" path={`candles/${detail.data.id}`} body={{ done: true }} tone="gold" successText={t('candles.doneToast')} />
                  ) : null}
                  <ApiAction
                    label={t('common.delete')}
                    icon="trash"
                    tone="danger"
                    method="DELETE"
                    path={`candles/${detail.data.id}`}
                    successText={t('candles.deletedToast')}
                    then={closeHref}
                    confirm={{ title: t('candles.confirmDeleteTitle'), message: t('candles.confirmDeleteText', { name: fullName(detail.data.firstName, detail.data.lastName) }), confirmLabel: t('common.delete') }}
                  />
                </div>
              ) : null}
            </>
          ) : detail && !detail.ok ? (
            <ErrorState error={detail.error} />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
