import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Icon } from '@/components/ui/Icon';
import { Badge, DataTable, EmptyState, ErrorState, hrefWith, ListToolbar, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { parseListParams, productsPage, type Product } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import { isCategory } from '@/lib/product-form';
import { can } from '@/lib/roles';
import { one } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.products') };
}

const DEFAULT_SORT = '-createdAt';

function StockBadge({ stock, t }: { stock: number | null | undefined; t: (key: 'products.unlimited' | 'products.outOfStock' | 'products.inStock' | 'products.lowStock', vars?: Record<string, string | number>) => string }) {
  if (stock === null || stock === undefined) return <Badge tone="neutral">{t('products.unlimited')}</Badge>;
  if (stock === 0) return <Badge tone="danger">{t('products.outOfStock')}</Badge>;
  if (stock <= 5) return <Badge tone="warn">{t('products.lowStock', { n: stock })}</Badge>;
  return <Badge tone="success">{t('products.inStock', { n: stock })}</Badge>;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const view = one(raw, 'view') === 'grid' ? 'grid' : 'table';
  const keep = { ...paramsOf(params, DEFAULT_SORT), view: view === 'grid' ? 'grid' : undefined };
  const canWrite = can(user.role, 'write');
  const categoryLabel = (key: string | null | undefined) => (isCategory(key) ? t(`category.${key}`) : (key ?? ''));
  const list = await load(() => serverApi({ path: '/admin/products', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: productsPage }));

  return (
    <>
      <PageHeader
        title={t('nav.products')}
        description={t('products.lead')}
        actions={
          canWrite ? (
            <Link className="btn btn--gold" href="/products/new">
              <Icon name="plus" size={18} />
              <span>{t('products.add')}</span>
            </Link>
          ) : undefined
        }
      />
      <ListToolbar
        action="/products"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'ok', label: t('products.filterOk') },
          { value: 'low', label: t('products.filterLow') },
          { value: 'out', label: t('products.filterOut') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'name', label: t('sort.nameAz') },
          { value: 'price', label: t('sort.priceLow') },
          { value: '-price', label: t('sort.priceHigh') },
          { value: 'stock', label: t('sort.stockLow') },
          { value: '-rate', label: t('sort.featured') },
        ]}
        hidden={{ view: view === 'grid' ? 'grid' : undefined }}
        searchLabel={t('products.search')}
        extra={
          <div className="segmented" role="group" aria-label={t('products.view')}>
            <Link className="segmented__item" href={hrefWith('/products', { ...keep, view: undefined })} aria-current={view === 'table' ? 'true' : undefined}>{t('products.viewTable')}</Link>
            <Link className="segmented__item" href={hrefWith('/products', { ...keep, view: 'grid' })} aria-current={view === 'grid' ? 'true' : undefined}>{t('products.viewGrid')}</Link>
          </div>
        }
      />

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={params.q || params.status ? t('state.noResults') : t('products.empty')}
          text={params.q || params.status ? t('state.noResultsText') : ''}
          action={canWrite && !params.q && !params.status ? <Link className="btn btn--gold btn--sm" href="/products/new">{t('products.add')}</Link> : undefined}
        />
      ) : (
        <>
          {view === 'grid' ? (
            <ul className="product-grid">
              {list.data.items.map((p) => (
                <li key={p.id} className="product-card">
                  <Link href={`/products/${p.id}`} className="product-card__image" aria-label={p.name}>
                    <img src={p.img} alt="" loading="lazy" />
                  </Link>
                  <div className="product-card__body">
                    <Link href={`/products/${p.id}`} className="product-card__name">{p.name}</Link>
                    <p className="product-card__meta">{categoryLabel(p.category)}</p>
                    <div className="product-card__row">
                      <strong>{formatMoney(p.price, locale)}</strong>
                      <StockBadge stock={p.stock} t={t} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DataTable<Product>
              caption={t('nav.products')}
              rows={list.data.items}
              rowKey={(p) => p.id}
              columns={[
                {
                  key: 'name',
                  header: t('products.colProduct'),
                  primary: true,
                  cell: (p) => (
                    <div className="product-cell">
                      <img className="thumb" src={p.img} alt="" loading="lazy" width={44} height={44} />
                      <div>
                        <Link className="link link--strong" href={`/products/${p.id}`}>{p.name}</Link>
                        {p.category ? <span className="cell-sub">{categoryLabel(p.category)}</span> : null}
                      </div>
                    </div>
                  ),
                },
                { key: 'price', header: t('products.price'), align: 'end', cell: (p) => <strong>{formatMoney(p.price, locale)}</strong> },
                { key: 'stock', header: t('products.stock'), cell: (p) => <StockBadge stock={p.stock} t={t} /> },
                { key: 'rate', header: t('products.rateShort'), align: 'end', cell: (p) => formatNumber(p.rate ?? 0, locale) },
                {
                  key: 'actions',
                  header: t('common.actions'),
                  align: 'end',
                  cell: (p) => (
                    <div className="row-actions">
                      <Link className="btn btn--ghost btn--sm" href={`/products/${p.id}`}>
                        <Icon name={canWrite ? 'edit' : 'eye'} size={16} />
                        <span>{canWrite ? t('common.edit') : t('common.view')}</span>
                      </Link>
                      {canWrite ? (
                        <ApiAction
                          label={t('common.delete')}
                          ariaLabel={t('products.deleteFor', { name: p.name })}
                          icon="trash"
                          iconOnly
                          tone="danger"
                          method="DELETE"
                          path={`products/${p.id}`}
                          successText={t('products.deletedToast')}
                          confirm={{ title: t('products.confirmDeleteTitle'), message: t('products.confirmDeleteText', { name: p.name }), confirmLabel: t('common.delete') }}
                        />
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          )}
          <Pagination base="/products" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}
    </>
  );
}
