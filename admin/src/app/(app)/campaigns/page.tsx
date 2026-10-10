import type { Metadata } from 'next';
import { DataTable, EmptyState, ErrorState, Ltr, PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { formatNumber } from '@/lib/format';
import { campaignName, dayParam, flowParam, FUNNEL_FLOWS, FUNNEL_STEPS, funnelSchema, share, type Funnel, type FunnelCounts } from '@/lib/funnel';
import { load, serverApi } from '@/lib/server-api';
import { CostPerCustomer } from './CostPerCustomer';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.campaigns') };
}

type CampaignRow = Funnel['campaigns'][number];
type DayRow = Funnel['days'][number];

// Campaigns (docs/ANALYTICS.md): how many visitors each advertising campaign brought and how many of them paid.
// The numbers are anonymous counts made without cookies (server/services/metrics.js); every admin may read them.
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const raw = await searchParams;
  const flow = flowParam(raw.flow);
  const from = dayParam(raw.from);
  const to = dayParam(raw.to);
  const report = await load(() => serverApi({ path: '/admin/metrics/funnel', query: { flow, from, to }, schema: funnelSchema }));

  const n = (value: number) => formatNumber(value, locale);
  const pct = (part: number, whole: number) => {
    const value = share(part, whole);
    return value === null ? '-' : `${formatNumber(value, locale)}%`;
  };
  const stepColumns = <Row extends FunnelCounts>() =>
    FUNNEL_STEPS.map((step) => ({ key: step, header: t(`campaigns.step.${step}`), align: 'end' as const, cell: (row: Row) => n(row[step]) }));

  return (
    <>
      <PageHeader title={t('nav.campaigns')} description={t('campaigns.lead')} />

      <form className="toolbar" method="get" action="/campaigns" aria-label={t('campaigns.filter')}>
        <div className="toolbar__select">
          <label htmlFor="funnel-flow">{t('campaigns.flow')}</label>
          <select id="funnel-flow" name="flow" className="select" defaultValue={flow}>
            {FUNNEL_FLOWS.map((value) => (
              <option key={value} value={value}>{t(`campaigns.flow.${value}`)}</option>
            ))}
          </select>
        </div>
        <div className="toolbar__select">
          <label htmlFor="funnel-from">{t('campaigns.from')}</label>
          <input id="funnel-from" name="from" type="date" className="input" defaultValue={report.ok ? report.data.from : from} />
        </div>
        <div className="toolbar__select">
          <label htmlFor="funnel-to">{t('campaigns.to')}</label>
          <input id="funnel-to" name="to" type="date" className="input" defaultValue={report.ok ? report.data.to : to} />
        </div>
        <div className="toolbar__spacer" />
        <button type="submit" className="btn btn--gold">{t('campaigns.show')}</button>
      </form>

      {!report.ok ? (
        <ErrorState error={report.error} />
      ) : (
        <>
          <Panel title={t('campaigns.funnelTitle')}>
            <ol className="funnel" data-testid="funnel">
              {FUNNEL_STEPS.map((step, i) => (
                <li key={step} className="funnel__step">
                  <span className="funnel__label">{t(`campaigns.step.${step}`)}</span>
                  <span className="funnel__value">{n(report.data.totals[step])}</span>
                  <span className="funnel__hint">{i === 0 ? t('campaigns.ofViewsFirst') : t('campaigns.ofViews', { pct: pct(report.data.totals[step], report.data.totals.view) })}</span>
                </li>
              ))}
            </ol>
            {report.data.paidConfirmed !== null ? (
              <p className="hint" data-testid="paid-confirmed">{t('campaigns.confirmed', { n: n(report.data.paidConfirmed) })}</p>
            ) : null}
            <p className="hint">{t('campaigns.countsNote')}</p>
          </Panel>

          <Panel title={t('campaigns.costTitle')}>
            <CostPerCustomer customers={report.data.paidConfirmed ?? report.data.totals.paid} />
          </Panel>

          <Panel title={t('campaigns.byCampaign')}>
            {report.data.campaigns.length === 0 ? (
              <EmptyState title={t('campaigns.empty')} text={t('campaigns.emptyText')} />
            ) : (
              <DataTable<CampaignRow>
                caption={t('campaigns.byCampaign')}
                rows={report.data.campaigns}
                rowKey={(row) => `${row.source}|${row.medium}|${row.campaign}`}
                columns={[
                  { key: 'name', header: t('campaigns.campaign'), primary: true, cell: (row) => (campaignName(row) ? <Ltr>{campaignName(row)}</Ltr> : <span className="muted">{t('campaigns.noCampaign')}</span>) },
                  ...stepColumns<CampaignRow>(),
                  { key: 'rate', header: t('campaigns.rate'), align: 'end', cell: (row) => pct(row.paid, row.view) },
                ]}
              />
            )}
          </Panel>

          {report.data.days.length > 0 ? (
            <Panel title={t('campaigns.byDay')}>
              <DataTable<DayRow>
                caption={t('campaigns.byDay')}
                rows={[...report.data.days].reverse()}
                rowKey={(row) => row.day}
                columns={[{ key: 'day', header: t('campaigns.day'), primary: true, cell: (row) => <Ltr>{row.day}</Ltr> }, ...stepColumns<DayRow>()]}
              />
            </Panel>
          ) : null}

          <Panel title={t('campaigns.howTitle')}>
            <p>{t('campaigns.howText')}</p>
            <p><Ltr>https://nazarethholycross.com/en/candle?utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign=easter</Ltr></p>
            <p className="hint">{t('campaigns.howHint')}</p>
          </Panel>
        </>
      )}
    </>
  );
}
