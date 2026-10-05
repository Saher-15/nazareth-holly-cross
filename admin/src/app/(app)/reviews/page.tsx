import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Badge, DataTable, EmptyState, ErrorState, ListToolbar, Ltr, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { parseListParams, productReviewsPage, siteReviewsPage, type ProductReview, type SiteReview } from '@/lib/api';
import { formatDateTime, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { one } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.reviews') };
}

const DEFAULT_SORT = '-createdAt';

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="stars" role="img" aria-label={`${full} / 5`}>
      <span aria-hidden="true">{'★'.repeat(full)}<span className="stars__off">{'★'.repeat(5 - full)}</span></span>
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const tab = one(raw, 'tab') === 'product' ? 'product' : 'site';
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const keep = { ...paramsOf(params, DEFAULT_SORT), tab: tab === 'product' ? 'product' : undefined };
  const canWrite = can(user.role, 'write');

  return (
    <>
      <PageHeader title={t('nav.reviews')} description={t('reviews.lead')} />
      <div className="tabs" role="navigation" aria-label={t('reviews.tabs')}>
        <Link className="tabs__tab" href="/reviews" aria-current={tab === 'site' ? 'page' : undefined}>{t('reviews.tabSite')}</Link>
        <Link className="tabs__tab" href="/reviews?tab=product" aria-current={tab === 'product' ? 'page' : undefined}>{t('reviews.tabProduct')}</Link>
      </div>
      <ListToolbar
        action="/reviews"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'approved', label: t('status.approved') },
          { value: 'hidden', label: t('status.hidden') },
        ]}
        sort={params.sort}
        sorts={
          tab === 'product'
            ? [
                { value: '-createdAt', label: t('sort.newest') },
                { value: 'createdAt', label: t('sort.oldest') },
                { value: '-rating', label: t('sort.ratingHigh') },
                { value: 'rating', label: t('sort.ratingLow') },
              ]
            : [
                { value: '-createdAt', label: t('sort.newest') },
                { value: 'createdAt', label: t('sort.oldest') },
              ]
        }
        hidden={{ tab: tab === 'product' ? 'product' : undefined }}
        searchLabel={t('reviews.search')}
      />
      {tab === 'site' ? <SiteReviews params={params} keep={keep} canWrite={canWrite} /> : <ProductReviews params={params} keep={keep} canWrite={canWrite} />}
    </>
  );
}

type ListProps = { params: ReturnType<typeof parseListParams>; keep: Record<string, string | number | undefined>; canWrite: boolean };

async function SiteReviews({ params, keep, canWrite }: ListProps) {
  const { t, locale } = await getI18n();
  const list = await load(() => serverApi({ path: '/admin/site-reviews', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: siteReviewsPage }));
  if (!list.ok) return <ErrorState error={list.error} />;
  if (list.data.items.length === 0) return <EmptyState title={params.q || params.status ? t('state.noResults') : t('reviews.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />;
  return (
    <>
      <DataTable<SiteReview>
        caption={t('reviews.tabSite')}
        rows={list.data.items}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'who',
            header: t('reviews.colFrom'),
            primary: true,
            cell: (r) => (
              <>
                <span className="strong">{r.fullName}</span>
                {r.email ? <span className="cell-sub"><Ltr>{r.email}</Ltr></span> : null}
              </>
            ),
          },
          { key: 'msg', header: t('reviews.colReview'), className: 'cell-wide', cell: (r) => truncate(r.msg, 200) },
          { key: 'date', header: t('common.date'), cell: (r) => formatDateTime(r.createdAt, locale) },
          { key: 'status', header: t('common.status'), cell: (r) => <Badge tone={r.approved ? 'success' : 'warn'}>{r.approved ? t('status.approved') : t('status.hidden')}</Badge> },
          {
            key: 'actions',
            header: t('common.actions'),
            align: 'end',
            cell: (r) =>
              canWrite ? (
                <div className="row-actions">
                  <ApiAction
                    label={r.approved ? t('reviews.hide') : t('reviews.approve')}
                    ariaLabel={(r.approved ? t('reviews.hideFor', { name: r.fullName }) : t('reviews.approveFor', { name: r.fullName }))}
                    icon={r.approved ? 'eyeOff' : 'eye'}
                    method="PATCH"
                    path={`site-reviews/${r.id}`}
                    body={{ approved: !r.approved }}
                    successText={r.approved ? t('reviews.hiddenToast') : t('reviews.approvedToast')}
                  />
                  <ApiAction
                    label={t('common.delete')}
                    ariaLabel={t('reviews.deleteFor', { name: r.fullName })}
                    icon="trash"
                    iconOnly
                    tone="danger"
                    method="DELETE"
                    path={`site-reviews/${r.id}`}
                    successText={t('reviews.deletedToast')}
                    confirm={{ title: t('reviews.confirmDeleteTitle'), message: t('reviews.confirmDeleteText', { name: r.fullName }), confirmLabel: t('common.delete') }}
                  />
                </div>
              ) : (
                <span className="muted">-</span>
              ),
          },
        ]}
      />
      <Pagination base="/reviews" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
    </>
  );
}

async function ProductReviews({ params, keep, canWrite }: ListProps) {
  const { t, locale } = await getI18n();
  const list = await load(() => serverApi({ path: '/admin/product-reviews', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: productReviewsPage }));
  if (!list.ok) return <ErrorState error={list.error} />;
  if (list.data.items.length === 0) return <EmptyState title={params.q || params.status ? t('state.noResults') : t('reviews.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />;
  const productName = (r: ProductReview) => (r.product && typeof r.product === 'object' ? (r.product.name ?? '-') : '-');
  return (
    <>
      <DataTable<ProductReview>
        caption={t('reviews.tabProduct')}
        rows={list.data.items}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'product',
            header: t('reviews.colProduct'),
            primary: true,
            cell: (r) => (
              <>
                <span className="strong">{productName(r)}</span>
                <span className="cell-sub">{r.name}{r.country ? `, ${r.country}` : ''}</span>
              </>
            ),
          },
          { key: 'rating', header: t('reviews.colRating'), cell: (r) => <Stars rating={r.rating} /> },
          {
            key: 'comment',
            header: t('reviews.colReview'),
            className: 'cell-wide',
            cell: (r) => (
              <>
                {r.title ? <span className="strong">{r.title}</span> : null}
                <span className="cell-sub cell-sub--text">{truncate(r.comment, 200)}</span>
              </>
            ),
          },
          { key: 'date', header: t('common.date'), cell: (r) => formatDateTime(r.createdAt, locale) },
          { key: 'status', header: t('common.status'), cell: (r) => <Badge tone={r.approved ? 'success' : 'warn'}>{r.approved ? t('status.approved') : t('status.hidden')}</Badge> },
          {
            key: 'actions',
            header: t('common.actions'),
            align: 'end',
            cell: (r) =>
              canWrite ? (
                <div className="row-actions">
                  <ApiAction
                    label={r.approved ? t('reviews.hide') : t('reviews.approve')}
                    ariaLabel={r.approved ? t('reviews.hideFor', { name: r.name }) : t('reviews.approveFor', { name: r.name })}
                    icon={r.approved ? 'eyeOff' : 'eye'}
                    method="PATCH"
                    path={`product-reviews/${r.id}`}
                    body={{ approved: !r.approved }}
                    successText={r.approved ? t('reviews.hiddenToast') : t('reviews.approvedToast')}
                  />
                  <ApiAction
                    label={t('common.delete')}
                    ariaLabel={t('reviews.deleteFor', { name: r.name })}
                    icon="trash"
                    iconOnly
                    tone="danger"
                    method="DELETE"
                    path={`product-reviews/${r.id}`}
                    successText={t('reviews.deletedToast')}
                    confirm={{ title: t('reviews.confirmDeleteTitle'), message: t('reviews.confirmDeleteText', { name: r.name }), confirmLabel: t('common.delete') }}
                  />
                </div>
              ) : (
                <span className="muted">-</span>
              ),
          },
        ]}
      />
      <Pagination base="/reviews" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
    </>
  );
}
