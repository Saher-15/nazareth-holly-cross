import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { Badge, DataTable, EmptyState, ErrorState, Field, hrefWith, ListToolbar, Ltr, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { paymentSchema, paymentsPage, parseListParams, type Payment } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber, mailtoHref, shortId } from '@/lib/format';
import { linkedHref, paymentState, payerLabel, requestTime, STATE_TONE } from '@/lib/payments';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { openParam } from '@/lib/search-params';
import { ResolvePayment } from './ResolvePayment';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.payments') };
}

const DEFAULT_SORT = '-createdAt';

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const open = openParam(raw);
  const keep = paramsOf(params, DEFAULT_SORT);

  const [list, detail, waiting] = await Promise.all([
    load(() => serverApi({ path: '/admin/payments', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: paymentsPage })),
    open ? load(() => serverApi({ path: `/admin/payments/${open}`, schema: paymentSchema })) : Promise.resolve(null),
    // How many customers paid and have nothing saved: the banner above the list (not needed when the list is that filter)
    params.status === 'unfulfilled' ? Promise.resolve(null) : load(() => serverApi({ path: '/admin/payments', query: { status: 'unfulfilled', size: 1 }, schema: paymentsPage })),
  ]);
  const canWrite = can(user.role, 'write');
  const waitingCount = waiting && waiting.ok ? waiting.data.total : 0;
  const now = requestTime();

  return (
    <>
      <PageHeader title={t('nav.payments')} description={t('payments.lead')} />

      {waitingCount > 0 ? (
        <p className="alert alert--warn" role="alert" data-testid="unfulfilled-alert">
          <Icon name="alert" size={18} />
          <span className="alert__body">
            <strong>{t('payments.alertTitle', { n: formatNumber(waitingCount, locale) })}</strong>
            <span>{t('payments.alertText')}</span>
            <Link className="link" href="/payments?status=unfulfilled">{t('payments.showUnfulfilled')}</Link>
          </span>
        </p>
      ) : null}

      <ListToolbar
        action="/payments"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'unfulfilled', label: t('payments.filter.unfulfilled') },
          { value: 'captured', label: t('payments.filter.captured') },
          { value: 'created', label: t('payments.filter.created') },
          { value: 'failed', label: t('payments.filter.failed') },
          { value: 'resolved', label: t('payments.filter.resolved') },
          { value: 'order', label: t('payments.filter.order') },
          { value: 'candle', label: t('payments.filter.candle') },
          { value: 'donation', label: t('payments.filter.donation') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
          { value: '-amount', label: t('sort.amountHigh') },
          { value: 'amount', label: t('sort.amountLow') },
        ]}
        hidden={{ size: params.size !== 25 ? params.size : undefined }}
        exportPath={can(user.role, 'export') ? '/api/proxy/export/payments.csv' : undefined}
        extra={
          can(user.role, 'export') ? (
            <a className="btn btn--ghost btn--sm" href="/api/proxy/export/payments.csv?status=unfulfilled" download>
              <Icon name="download" size={16} />
              <span>{t('payments.exportUnfulfilled')}</span>
            </a>
          ) : undefined
        }
        searchLabel={t('payments.search')}
      />

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={params.q || params.status ? t('state.noResults') : t('payments.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<Payment>
            caption={t('nav.payments')}
            rows={list.data.items}
            rowKey={(p) => p.id}
            rowClass={(p) => (paymentState(p, now) === 'unfulfilled' ? 'is-attention' : undefined)}
            columns={[
              {
                key: 'payment',
                header: t('payments.colPayment'),
                primary: true,
                cell: (p) => (
                  <>
                    <Link className="link link--strong" href={hrefWith('/payments', { ...keep, open: p.id })} scroll={false}>
                      <Ltr>{p.paypalOrderId}</Ltr>
                    </Link>
                    <span className="cell-sub">{formatDateTime(p.createdAt, locale)}</span>
                  </>
                ),
              },
              { key: 'type', header: t('payments.colType'), cell: (p) => t(`payments.type.${knownType(p.type)}`) },
              {
                key: 'payer',
                header: t('payments.colPayer'),
                cell: (p) => (
                  <>
                    <span>{payerLabel(p) || '-'}</span>
                    {p.payerEmail ? <span className="cell-sub"><Ltr>{p.payerEmail}</Ltr></span> : null}
                  </>
                ),
              },
              { key: 'amount', header: t('payments.colAmount'), align: 'end', cell: (p) => <strong>{formatMoney(p.amount, locale)}</strong> },
              { key: 'status', header: t('common.status'), cell: (p) => { const s = paymentState(p, now); return <Badge tone={STATE_TONE[s]}>{t(`payments.state.${s}`)}</Badge>; } },
              {
                key: 'linked',
                header: t('payments.colLinked'),
                cell: (p) => {
                  const href = linkedHref(p);
                  return href ? <Link className="link" href={href}>{p.linkedTo?.kind === 'candle' ? t('payments.linkedCandle') : t('payments.linkedOrder')}</Link> : '-';
                },
              },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (p) => <Link className="btn btn--ghost btn--sm" href={hrefWith('/payments', { ...keep, open: p.id })} scroll={false}>{t('common.view')}</Link>,
              },
            ]}
          />
          <Pagination base="/payments" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}

      {open ? (
        <Drawer title={t('payments.detailTitle')} closeHref={hrefWith('/payments', keep)}>
          {detail && detail.ok ? <PaymentDetail payment={detail.data} canWrite={canWrite} now={now} /> : detail && !detail.ok ? <ErrorState error={detail.error} /> : null}
        </Drawer>
      ) : null}
    </>
  );
}

const TYPES = ['order', 'candle', 'donation', 'unknown'] as const;
const knownType = (type: string): (typeof TYPES)[number] => ((TYPES as readonly string[]).includes(type) ? (type as (typeof TYPES)[number]) : 'unknown');

async function PaymentDetail({ payment, canWrite, now }: { payment: Payment; canWrite: boolean; now: number }) {
  const { t, locale } = await getI18n();
  const state = paymentState(payment, now);
  const href = linkedHref(payment);
  const payer = payerLabel(payment);
  return (
    <>
      <div className="detail-head">
        <div>
          <p className="detail-head__id">#{shortId(payment.id)}</p>
          <p className="muted"><Ltr>{payment.paypalOrderId}</Ltr></p>
        </div>
        <Badge tone={STATE_TONE[state]}>{t(`payments.state.${state}`)}</Badge>
      </div>

      {state === 'unfulfilled' ? <p className="alert alert--warn" role="status"><Icon name="alert" size={18} /><span>{t('payments.unfulfilledHint')}</span></p> : null}
      {state === 'processing' ? <p className="alert alert--info" role="status"><Icon name="info" size={18} /><span>{t('payments.processingHint')}</span></p> : null}

      <dl className="fields">
        <Field label={t('payments.colType')}>{t(`payments.type.${knownType(payment.type)}`)}</Field>
        <Field label={t('payments.colAmount')}><strong>{formatMoney(payment.amount, locale)}</strong> {payment.currency && payment.currency !== 'USD' ? payment.currency : ''}</Field>
        <Field label={t('payments.createdAt')}>{formatDateTime(payment.createdAt, locale)}</Field>
        <Field label={t('payments.capturedAt')}>{payment.capturedAt ? formatDateTime(payment.capturedAt, locale) : '-'}</Field>
        <Field label={t('payments.colPayer')}>{payer || '-'}</Field>
        <Field label={t('common.email')}>
          {payment.payerEmail ? <a className="link" href={mailtoHref(payment.payerEmail) ?? undefined}><Ltr>{payment.payerEmail}</Ltr></a> : '-'}
        </Field>
        {payment.donorName ? <Field label={t('payments.donor')}>{payment.donorName}</Field> : null}
        <Field label={t('payments.colLinked')} wide>
          {href ? <Link className="link" href={href}>{payment.linkedTo?.kind === 'candle' ? t('payments.linkedCandle') : t('payments.linkedOrder')}</Link> : state === 'received' ? t('payments.noLinkNeeded') : t('payments.notLinked')}
        </Field>
        {payment.resolvedAt ? (
          <Field label={t('payments.resolution')} wide>
            <span>{payment.notes || '-'}</span>
            <span className="cell-sub">{t('payments.resolvedBy', { name: payment.resolvedBy || '-', date: formatDateTime(payment.resolvedAt, locale) })}</span>
          </Field>
        ) : payment.notes ? (
          <Field label={t('payments.note')} wide>{payment.notes}</Field>
        ) : null}
      </dl>

      {canWrite && (state === 'unfulfilled' || state === 'processing') ? (
        <div className="drawer__actions">
          <ResolvePayment id={payment.id} />
        </div>
      ) : null}
      {canWrite && state === 'resolved' ? (
        <div className="drawer__actions">
          <ApiAction label={t('payments.reopen')} icon="clock" method="PATCH" path={`payments/${payment.id}`} body={{ resolved: false }} successText={t('payments.reopenedToast')} />
        </div>
      ) : null}
    </>
  );
}
