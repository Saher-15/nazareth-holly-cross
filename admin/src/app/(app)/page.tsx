import type { Metadata } from 'next';
import Link from 'next/link';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, EmptyState, ErrorState, Ltr, PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { dashboardSchema, type Dashboard } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber, fullName, truncate } from '@/lib/format';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.dashboard') };
}

function Kpi({ label, value, hint, href, icon, tone }: { label: string; value: string; hint?: string; href: string; icon: IconName; tone?: 'gold' | 'warn' }) {
  return (
    <Link href={href} className={`kpi ${tone ? `kpi--${tone}` : ''}`.trim()}>
      <span className="kpi__icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      {hint ? <span className="kpi__hint">{hint}</span> : null}
    </Link>
  );
}

export default async function DashboardPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  const result = await load(() => serverApi({ path: '/admin/dashboard', schema: dashboardSchema }));

  return (
    <>
      <PageHeader eyebrow={t('dash.welcome', { name: user.username })} title={t('nav.dashboard')} description={t('dash.lead')} />
      {result.ok ? <DashboardBody data={result.data} /> : <ErrorState error={result.error} />}
    </>
  );
}

async function DashboardBody({ data }: { data: Dashboard }) {
  const { t, locale } = await getI18n();
  const { totals, last30Days, topProducts, lowStock, recent } = data;
  const maxSold = Math.max(1, ...topProducts.map((p) => p.sold));
  const orders30 = last30Days.reduce((s, d) => s + d.orders, 0);
  const revenue30 = last30Days.reduce((s, d) => s + d.revenue, 0);

  return (
    <>
      <section className="kpis" aria-label={t('dash.kpis')}>
        <Kpi icon="orders" label={t('dash.kpiOrders')} value={formatNumber(totals.orders, locale)} hint={t('dash.kpiOrdersHint', { n: formatNumber(totals.ordersPending, locale) })} href="/orders" tone={totals.ordersPending ? 'gold' : undefined} />
        <Kpi icon="dashboard" label={t('dash.kpiRevenue')} value={formatMoney(totals.revenue, locale, true)} hint={t('dash.kpiRevenueHint', { amount: formatMoney(revenue30, locale, true), n: formatNumber(orders30, locale) })} href="/orders" />
        <Kpi icon="candles" label={t('dash.kpiCandles')} value={formatNumber(totals.candles, locale)} hint={t('dash.kpiPendingHint', { n: formatNumber(totals.candlesPending, locale) })} href="/candles" tone={totals.candlesPending ? 'gold' : undefined} />
        <Kpi icon="mail" label={t('dash.kpiContacts')} value={formatNumber(totals.contacts, locale)} hint={t('dash.kpiOpenHint', { n: formatNumber(totals.contactsOpen, locale) })} href="/contacts" tone={totals.contactsOpen ? 'gold' : undefined} />
        <Kpi icon="products" label={t('dash.kpiProducts')} value={formatNumber(totals.products, locale)} hint={t('dash.kpiLowHint', { n: formatNumber(lowStock.length, locale) })} href="/products" tone={lowStock.length ? 'warn' : undefined} />
        <Kpi icon="reviews" label={t('dash.kpiSiteReviews')} value={formatNumber(totals.reviews, locale)} href="/reviews" />
        <Kpi icon="reviews" label={t('dash.kpiProductReviews')} value={formatNumber(totals.productReviews, locale)} href="/reviews?tab=product" />
        <Kpi icon="prayers" label={t('dash.kpiPrayers')} value={formatNumber(totals.prayers, locale)} href="/prayers" />
      </section>

      <div className="grid grid--charts">
        <Panel title={t('dash.chartOrders')} className="panel--chart">
          <TimeSeriesChart title={t('dash.chartOrders')} days={last30Days} bars={{ key: 'orders', label: t('dash.seriesOrders') }} line={{ key: 'revenue', label: t('dash.seriesRevenue') }} />
        </Panel>
        <Panel title={t('dash.chartCandles')} className="panel--chart">
          <TimeSeriesChart title={t('dash.chartCandles')} days={last30Days} bars={{ key: 'candles', label: t('dash.seriesCandles') }} />
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title={t('dash.topProducts')} action={<Link className="link" href="/products">{t('common.viewAll')}</Link>}>
          {topProducts.length ? (
            <ol className="ranking">
              {topProducts.map((p, i) => (
                <li key={`${p.productId ?? p.name}-${i}`} className="ranking__item">
                  <span className="ranking__rank" aria-hidden="true">{i + 1}</span>
                  <div className="ranking__main">
                    <div className="ranking__row">
                      <span className="ranking__name">{p.name}</span>
                      <span className="ranking__value">{t('dash.sold', { n: formatNumber(p.sold, locale) })}</span>
                    </div>
                    <svg className="meter" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label={`${p.name}: ${formatNumber(p.sold, locale)}`}>
                      <rect className="meter__track" x="0" y="0" width="100" height="6" rx="3" />
                      <rect className="meter__fill" x="0" y="0" width={(p.sold / maxSold) * 100} height="6" rx="3" />
                    </svg>
                    <span className="ranking__sub">{formatMoney(p.revenue, locale)}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState />
          )}
        </Panel>

        <Panel title={t('dash.lowStock')} action={<Link className="link" href="/products?status=low">{t('common.viewAll')}</Link>}>
          {lowStock.length ? (
            <ul className="list">
              {lowStock.map((p, i) => (
                <li key={`${p.productId ?? p.name}-${i}`} className="list__item">
                  <span className="list__main">{p.productId ? <Link className="link" href={`/products/${p.productId}`}>{p.name}</Link> : p.name}</span>
                  <Badge tone={p.stock === 0 ? 'danger' : 'warn'}>{p.stock === 0 ? t('products.outOfStock') : t('dash.left', { n: p.stock })}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('dash.stockOk')} text="" />
          )}
        </Panel>
      </div>

      <div className="grid grid--three">
        <Panel title={t('dash.recentOrders')} action={<Link className="link" href="/orders">{t('common.viewAll')}</Link>}>
          {recent.orders.length ? (
            <ul className="list">
              {recent.orders.map((o) => (
                <li key={o.id} className="list__item">
                  <span className="list__main">
                    <Link className="link" href={`/orders?open=${o.id}`}>{fullName(o.firstName, o.lastName)}</Link>
                    <span className="list__sub">{formatDateTime(o.createdAt ?? o.date, locale)}</span>
                  </span>
                  <span className="list__end">
                    <span>{formatMoney(o.totalPrice, locale)}</span>
                    <Badge tone={o.done ? 'success' : 'gold'}>{o.done ? t('status.shipped') : t('status.pending')}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </Panel>
        <Panel title={t('dash.recentCandles')} action={<Link className="link" href="/candles">{t('common.viewAll')}</Link>}>
          {recent.candles.length ? (
            <ul className="list">
              {recent.candles.map((c) => (
                <li key={c.id} className="list__item">
                  <span className="list__main">
                    <Link className="link" href={`/candles?open=${c.id}`}>{fullName(c.firstName, c.lastName)}</Link>
                    <span className="list__sub">{truncate(c.prayer, 60)}</span>
                  </span>
                  <Badge tone={c.done ? 'success' : 'gold'}>{c.done ? t('status.done') : t('status.pending')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </Panel>
        <Panel title={t('dash.recentContacts')} action={<Link className="link" href="/contacts">{t('common.viewAll')}</Link>}>
          {recent.contacts.length ? (
            <ul className="list">
              {recent.contacts.map((c) => (
                <li key={c.id} className="list__item">
                  <span className="list__main">
                    <Link className="link" href={`/contacts?open=${c.id}`}>{c.fullName}</Link>
                    <span className="list__sub"><Ltr>{c.email}</Ltr></span>
                  </span>
                  <Badge tone={c.done ? 'success' : 'gold'}>{c.done ? t('status.done') : t('status.open')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </Panel>
      </div>
    </>
  );
}
