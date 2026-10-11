import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ErrorState } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { orderSchema } from '@/lib/api';
import { addressLines, formatDate, fullName, orderNumber } from '@/lib/format';
import { getSession, load, serverApi } from '@/lib/server-api';
import { PrintButton } from './PrintButton';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('slip.title') };
}

// The packing slip of one order (review 04 finding 30): what goes in the parcel and where it goes, large enough to
// copy onto a label, with no prices. Every signed-in role may open it (it shows what the order drawer shows). It lives
// outside the dashboard's layout (no menu to print) and opens in a new tab from the order drawer.
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getI18n();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  await getSession();
  const result = await load(() => serverApi({ path: `/admin/orders/${id}`, schema: orderSchema }));
  if (!result.ok && (result.error.status === 404 || result.error.status === 400)) notFound();

  return (
    <main id="main" className="slip-page" tabIndex={-1}>
      {!result.ok ? (
        <ErrorState error={result.error} />
      ) : (
        <article className="slip" aria-labelledby="slip-title" data-testid="packing-slip">
          <div className="slip__tools no-print">
            <PrintButton />
            <Link className="btn btn--ghost btn--sm" href={`/orders?open=${result.data.id}`}>{t('slip.back')}</Link>
          </div>
          <header className="slip__head">
            <p className="slip__brand">{t('slip.brand')}</p>
            <h1 id="slip-title" className="slip__title">
              {t('slip.title')} <bdi className="ltr">{orderNumber(result.data.id)}</bdi>
            </h1>
            <p className="slip__date">{formatDate(result.data.createdAt ?? result.data.date, locale)}</p>
          </header>
          <section className="slip__to" aria-labelledby="slip-to">
            <h2 id="slip-to" className="slip__label">{t('slip.shipTo')}</h2>
            <address className="address slip__address">
              <bdi dir="auto" className="address__line slip__name">{fullName(result.data.firstName, result.data.lastName)}</bdi>
              {addressLines(result.data).map((line, i) => <bdi key={i} dir="auto" className="address__line">{line}</bdi>)}
              {result.data.phone ? <bdi dir="ltr" className="address__line">{result.data.phone}</bdi> : null}
            </address>
          </section>
          <section aria-labelledby="slip-items">
            <h2 id="slip-items" className="slip__label">{t('slip.items')}</h2>
            <table className="slip__table">
              <thead>
                <tr>
                  <th scope="col">{t('slip.item')}</th>
                  <th scope="col">{t('slip.colour')}</th>
                  <th scope="col" className="is-end">{t('slip.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.products.map((line, i) => (
                  <tr key={`${line.productID ?? line.productName}-${i}`}>
                    <td><bdi>{line.productName ?? '-'}</bdi></td>
                    <td><bdi>{line.color || '-'}</bdi></td>
                    <td className="is-end">{line.quantity ?? 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="slip__count">{t('slip.count', { n: result.data.products.reduce((s, p) => s + (p.quantity ?? 1), 0) })}</p>
          </section>
        </article>
      )}
    </main>
  );
}
