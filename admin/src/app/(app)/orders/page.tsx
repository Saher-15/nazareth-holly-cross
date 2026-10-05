import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Drawer } from '@/components/ui/Drawer';
import { Badge, DataTable, EmptyState, ErrorState, Field, hrefWith, ListToolbar, Ltr, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { orderSchema, ordersPage, parseListParams, type Order } from '@/lib/api';
import { formatDateTime, formatMoney, fullName, shortId } from '@/lib/format';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { openParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.orders') };
}

const DEFAULT_SORT = '-createdAt';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const open = openParam(raw);
  const keep = paramsOf(params, DEFAULT_SORT);

  const [list, detail] = await Promise.all([
    load(() => serverApi({ path: '/admin/orders', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: ordersPage })),
    open ? load(() => serverApi({ path: `/admin/orders/${open}`, schema: orderSchema })) : Promise.resolve(null),
  ]);
  const canWrite = can(user.role, 'write');
  const canDelete = can(user.role, 'deleteOrders');

  return (
    <>
      <PageHeader
        title={t('nav.orders')}
        description={t('orders.lead')}
      />
      <ListToolbar
        action="/orders"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'pending', label: t('status.pending') },
          { value: 'shipped', label: t('status.shipped') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
          { value: '-totalPrice', label: t('sort.totalHigh') },
          { value: 'totalPrice', label: t('sort.totalLow') },
        ]}
        hidden={{ size: params.size !== 25 ? params.size : undefined }}
        exportPath="/api/proxy/export/orders.csv"
        searchLabel={t('orders.search')}
      />

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={params.q || params.status ? t('state.noResults') : t('orders.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<Order>
            caption={t('nav.orders')}
            rows={list.data.items}
            rowKey={(o) => o.id}
            columns={[
              {
                key: 'order',
                header: t('orders.colOrder'),
                primary: true,
                cell: (o) => (
                  <>
                    <Link className="link link--strong" href={hrefWith('/orders', { ...keep, open: o.id })} scroll={false}>
                      #{shortId(o.id)}
                    </Link>
                    <span className="cell-sub">{formatDateTime(o.createdAt ?? o.date, locale)}</span>
                  </>
                ),
              },
              {
                key: 'customer',
                header: t('orders.colCustomer'),
                cell: (o) => (
                  <>
                    <span>{fullName(o.firstName, o.lastName)}</span>
                    <span className="cell-sub"><Ltr>{o.email}</Ltr></span>
                  </>
                ),
              },
              { key: 'where', header: t('orders.colLocation'), cell: (o) => [o.city, o.country].filter(Boolean).join(', ') || '-' },
              { key: 'items', header: t('orders.colItems'), align: 'end', cell: (o) => o.products.reduce((s, p) => s + (p.quantity ?? 0), 0) },
              { key: 'total', header: t('orders.colTotal'), align: 'end', cell: (o) => <strong>{formatMoney(o.totalPrice, locale)}</strong> },
              { key: 'status', header: t('common.status'), cell: (o) => <Badge tone={o.done ? 'success' : 'gold'}>{o.done ? t('status.shipped') : t('status.pending')}</Badge> },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (o) => (
                  <div className="row-actions">
                    <Link className="btn btn--ghost btn--sm" href={hrefWith('/orders', { ...keep, open: o.id })} scroll={false}>{t('common.view')}</Link>
                    {canWrite && !o.done ? (
                      <ApiAction
                        label={t('orders.markShipped')}
                        ariaLabel={t('orders.markShippedFor', { name: fullName(o.firstName, o.lastName) })}
                        icon="truck"
                        method="PATCH"
                        path={`orders/${o.id}`}
                        body={{ done: true }}
                        tone="gold"
                        successText={t('orders.shippedToast')}
                        confirm={{ title: t('orders.confirmShipTitle'), message: t('orders.confirmShipText', { name: fullName(o.firstName, o.lastName), email: o.email }), confirmLabel: t('orders.markShipped'), tone: 'primary' }}
                      />
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination base="/orders" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}

      {open ? (
        <Drawer title={t('orders.detailTitle')} closeHref={hrefWith('/orders', keep)}>
          {detail && detail.ok ? (
            <OrderDetail order={detail.data} canWrite={canWrite} canDelete={canDelete} closeHref={hrefWith('/orders', keep)} />
          ) : detail && !detail.ok ? (
            <ErrorState error={detail.error} />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}

async function OrderDetail({ order, canWrite, canDelete, closeHref }: { order: Order; canWrite: boolean; canDelete: boolean; closeHref: string }) {
  const { t, locale } = await getI18n();
  const name = fullName(order.firstName, order.lastName);
  const address = [order.street, order.city, order.state, order.postal, order.country].filter(Boolean).join(', ');
  return (
    <>
      <div className="detail-head">
        <div>
          <p className="detail-head__id">#{shortId(order.id)}</p>
          <p className="muted">{formatDateTime(order.createdAt ?? order.date, locale)}</p>
        </div>
        <Badge tone={order.done ? 'success' : 'gold'}>{order.done ? t('status.shipped') : t('status.pending')}</Badge>
      </div>
      <dl className="fields">
        <Field label={t('orders.colCustomer')}>{name}</Field>
        <Field label={t('common.email')}><a className="link" href={`mailto:${order.email}`}><Ltr>{order.email}</Ltr></a></Field>
        <Field label={t('common.phone')}>{order.phone ? <Ltr>{order.phone}</Ltr> : '-'}</Field>
        <Field label={t('orders.address')} wide>{address || '-'}</Field>
        <Field label={t('orders.payment')}>
          {order.paymentVerified ? <Badge tone="success">{t('orders.paymentVerified')}</Badge> : <Badge tone="warn">{t('orders.paymentUnverified')}</Badge>}
          {order.paypalOrderId ? <span className="cell-sub"><Ltr>{order.paypalOrderId}</Ltr></span> : null}
        </Field>
        <Field label={t('orders.colTotal')}><strong>{formatMoney(order.totalPrice, locale)}</strong></Field>
      </dl>
      <h3 className="drawer__subtitle">{t('orders.items')}</h3>
      <ul className="lines">
        {order.products.map((line, i) => (
          <li key={`${line.productID ?? line.productName}-${i}`} className="lines__item">
            <span>{line.productName ?? '-'}{line.color ? <span className="cell-sub">{t('orders.colour', { colour: line.color })}</span> : null}</span>
            <span className="lines__qty">&times; {line.quantity ?? 1}</span>
          </li>
        ))}
      </ul>
      {canWrite || canDelete ? (
        <div className="drawer__actions">
          {canWrite && !order.done ? (
            <ApiAction
              label={t('orders.markShipped')}
              icon="truck"
              method="PATCH"
              path={`orders/${order.id}`}
              body={{ done: true }}
              tone="gold"
              successText={t('orders.shippedToast')}
              confirm={{ title: t('orders.confirmShipTitle'), message: t('orders.confirmShipText', { name, email: order.email }), confirmLabel: t('orders.markShipped'), tone: 'primary' }}
            />
          ) : null}
          {canDelete ? (
            <ApiAction
              label={t('common.delete')}
              icon="trash"
              method="DELETE"
              path={`orders/${order.id}`}
              tone="danger"
              successText={t('orders.deletedToast')}
              then={closeHref}
              confirm={{ title: t('orders.confirmDeleteTitle'), message: t('orders.confirmDeleteText', { name }), confirmLabel: t('common.delete') }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
