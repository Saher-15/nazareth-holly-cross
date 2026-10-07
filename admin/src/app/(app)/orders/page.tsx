import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { Badge, DataTable, EmptyState, ErrorState, Field, hrefWith, ListToolbar, Ltr, Money, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { orderSchema, ordersPage, parseListParams, type Order } from '@/lib/api';
import { addressLines, formatDateTime, formatMoney, fullName, mailtoHref, orderNumber } from '@/lib/format';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { openParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.orders') };
}

const DEFAULT_SORT = '-createdAt';

/** "Mark shipped" with its confirmation; a payment PayPal did not confirm gets a warning confirm instead (review 04 finding 10). */
async function ShipAction({ order, withName }: { order: Order; withName?: boolean }) {
  const { t } = await getI18n();
  const name = fullName(order.firstName, order.lastName);
  const verified = order.paymentVerified === true;
  return (
    <ApiAction
      label={t('orders.markShipped')}
      ariaLabel={withName ? t('orders.markShippedFor', { name }) : undefined}
      icon="truck"
      method="PATCH"
      path={`orders/${order.id}`}
      body={{ done: true }}
      tone="gold"
      successText={t('orders.shippedToast')}
      emailResult={{ failed: t('orders.shippedNoMail'), none: t('orders.shippedAlready') }}
      undo={{ body: { done: false }, doneText: t('orders.unshippedUndo') }}
      confirm={
        verified
          ? { title: t('orders.confirmShipTitle'), message: t('orders.confirmShipText', { name, email: order.email }), confirmLabel: t('orders.markShipped'), tone: 'primary' }
          : { title: t('orders.confirmShipUnverifiedTitle'), message: t('orders.confirmShipUnverifiedText', { name, email: order.email }), confirmLabel: t('orders.markShippedAnyway'), tone: 'danger' }
      }
      testId={withName ? undefined : 'order-ship'}
    />
  );
}

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
          { value: 'unverified', label: t('status.unverified') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
          { value: '-totalPrice', label: t('sort.totalHigh') },
          { value: 'totalPrice', label: t('sort.totalLow') },
        ]}
        hidden={{ size: params.size !== 25 ? params.size : undefined }}
        exportPath={can(user.role, 'export') ? '/api/proxy/export/orders.csv' : undefined}
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
                      <bdi className="ltr">{orderNumber(o.id)}</bdi>
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
                    <bdi>{fullName(o.firstName, o.lastName)}</bdi>
                    <span className="cell-sub"><Ltr>{o.email}</Ltr></span>
                  </>
                ),
              },
              { key: 'where', header: t('orders.colLocation'), cell: (o) => <bdi>{[o.city, o.country].filter(Boolean).join(', ') || '-'}</bdi> },
              { key: 'items', header: t('orders.colItems'), align: 'end', cell: (o) => o.products.reduce((s, p) => s + (p.quantity ?? 0), 0) },
              { key: 'total', header: t('orders.colTotal'), align: 'end', cell: (o) => <strong><Money>{formatMoney(o.totalPrice, locale)}</Money></strong> },
              {
                key: 'status',
                header: t('common.status'),
                cell: (o) => (
                  <span className="badges">
                    <Badge tone={o.done ? 'success' : 'gold'}>{o.done ? t('status.shipped') : t('status.pending')}</Badge>
                    {o.paymentVerified !== true ? (
                      <Badge tone="warn"><span data-testid="order-unverified">{t('status.unverified')}</span></Badge>
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (o) => (
                  <div className="row-actions">
                    <Link className="btn btn--ghost btn--sm" href={hrefWith('/orders', { ...keep, open: o.id })} scroll={false} aria-label={t('orders.viewFor', { number: orderNumber(o.id) })}>{t('common.view')}</Link>
                    {canWrite && !o.done ? <ShipAction order={o} withName /> : null}
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
  // One line per part, each isolated: "53 Pilgrim Road" keeps its house number in front in Hebrew and Arabic too
  // (review 04 finding 11: the whole address as one Latin string was reordered by the right-to-left page).
  const lines = addressLines(order);
  return (
    <>
      <div className="detail-head">
        <div>
          <p className="detail-head__id"><bdi className="ltr">{orderNumber(order.id)}</bdi></p>
          <p className="muted">{formatDateTime(order.createdAt ?? order.date, locale)}</p>
        </div>
        <span className="badges">
          <Badge tone={order.done ? 'success' : 'gold'}>{order.done ? t('status.shipped') : t('status.pending')}</Badge>
          {order.paymentVerified !== true ? <Badge tone="warn">{t('status.unverified')}</Badge> : null}
        </span>
      </div>
      {order.paymentVerified !== true && !order.done ? (
        <p className="alert alert--warn" role="note">
          <Icon name="alert" size={18} />
          <span className="alert__body">{t('orders.unverifiedWarning')}</span>
        </p>
      ) : null}
      <dl className="fields">
        <Field label={t('orders.colCustomer')}><bdi>{name}</bdi></Field>
        <Field label={t('common.email')}><a className="link" href={mailtoHref(order.email) ?? undefined}><Ltr>{order.email}</Ltr></a></Field>
        <Field label={t('common.phone')}>{order.phone ? <Ltr>{order.phone}</Ltr> : '-'}</Field>
        <Field label={t('orders.address')} wide>
          {lines.length ? (
            <address className="address" data-testid="order-address">
              {lines.map((line, i) => <bdi key={i} dir="auto" className="address__line">{line}</bdi>)}
            </address>
          ) : '-'}
        </Field>
        <Field label={t('orders.payment')}>
          {order.paymentVerified ? <Badge tone="success">{t('orders.paymentVerified')}</Badge> : <Badge tone="warn">{t('orders.paymentUnverified')}</Badge>}
          {order.paypalOrderId ? <span className="cell-sub"><Ltr>{order.paypalOrderId}</Ltr></span> : null}
        </Field>
        <Field label={t('orders.colTotal')}><strong><Money>{formatMoney(order.totalPrice, locale)}</Money></strong></Field>
      </dl>
      <h3 className="drawer__subtitle">{t('orders.items')}</h3>
      <ul className="lines">
        {order.products.map((line, i) => (
          <li key={`${line.productID ?? line.productName}-${i}`} className="lines__item">
            <span><bdi>{line.productName ?? '-'}</bdi>{line.color ? <span className="cell-sub">{t('orders.colour', { colour: line.color })}</span> : null}</span>
            <span className="lines__qty">&times; {line.quantity ?? 1}</span>
          </li>
        ))}
      </ul>
      <div className="drawer__actions">
        {/* A new tab: the packing slip prints on its own (and never disturbs a broadcast in this tab). */}
        <a className="btn btn--ghost btn--sm" href={`/print/orders/${order.id}`} target="_blank" rel="noopener" data-testid="order-slip">
          <Icon name="orders" size={16} />
          <span>{t('orders.printSlip')}</span>
        </a>
        {canWrite && !order.done ? <ShipAction order={order} /> : null}
        {canWrite && order.done ? (
          <ApiAction
            label={t('orders.unship')}
            icon="undo"
            method="PATCH"
            path={`orders/${order.id}`}
            body={{ done: false }}
            successText={t('orders.unshippedToast')}
            confirm={{ title: t('orders.confirmUnshipTitle'), message: t('orders.confirmUnshipText', { name }), confirmLabel: t('orders.unship'), tone: 'primary' }}
            testId="order-unship"
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
    </>
  );
}
