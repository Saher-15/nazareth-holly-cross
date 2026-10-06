import type { Metadata } from 'next';
import { ApiAction } from '@/components/ui/ApiAction';
import { Badge, DataTable, EmptyState, ErrorState, ListToolbar, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { parseListParams, prayersPage, type Prayer } from '@/lib/api';
import { formatDateTime, formatNumber, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.prayers') };
}

const DEFAULT_SORT = '-createdAt';

export default async function PrayersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const params = parseListParams(await searchParams, { sort: DEFAULT_SORT });
  const keep = paramsOf(params, DEFAULT_SORT);
  const canWrite = can(user.role, 'write');
  const list = await load(() => serverApi({ path: '/admin/prayers', query: { page: params.page, size: params.size, q: params.q, sort: params.sort }, schema: prayersPage }));

  return (
    <>
      <PageHeader title={t('nav.prayers')} description={t('prayers.lead')} />
      <ListToolbar
        action="/prayers"
        q={params.q}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
          { value: '-likes', label: t('sort.mostLiked') },
        ]}
        searchLabel={t('prayers.search')}
      />
      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={params.q ? t('state.noResults') : t('prayers.empty')} text={params.q ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<Prayer>
            caption={t('nav.prayers')}
            rows={list.data.items}
            rowKey={(p) => p.id}
            columns={[
              {
                key: 'who',
                header: t('prayers.colFrom'),
                primary: true,
                cell: (p) => (
                  <>
                    <span className="strong">{p.name}</span>
                    <span className="cell-sub">{p.country ?? ''}</span>
                  </>
                ),
              },
              { key: 'prayer', header: t('prayers.colPrayer'), className: 'cell-wide', cell: (p) => truncate(p.prayer, 160) },
              { key: 'category', header: t('prayers.colCategory'), cell: (p) => (p.category ? <Badge tone="info">{p.category}</Badge> : '-') },
              { key: 'likes', header: t('prayers.colLikes'), align: 'end', cell: (p) => formatNumber(p.likes ?? 0, locale) },
              { key: 'date', header: t('common.date'), cell: (p) => formatDateTime(p.createdAt, locale) },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (p) =>
                  canWrite ? (
                    <div className="row-actions">
                      <ApiAction
                        label={t('common.delete')}
                        ariaLabel={t('prayers.deleteFor', { name: p.name })}
                        icon="trash"
                        iconOnly
                        tone="danger"
                        method="DELETE"
                        path={`prayers/${p.id}`}
                        successText={t('prayers.deletedToast')}
                        confirm={{ title: t('prayers.confirmDeleteTitle'), message: t('prayers.confirmDeleteText', { name: p.name }), confirmLabel: t('common.delete') }}
                      />
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  ),
              },
            ]}
          />
          <Pagination base="/prayers" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}
    </>
  );
}
