import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import type { ApiError } from '@/lib/api';
import { Icon, type IconName } from './Icon';

// Server-rendered building blocks shared by every page.

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title" tabIndex={-1} id="page-title">{title}</h1>
        {description ? <p className="page-lead">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export type Tone = 'neutral' | 'gold' | 'success' | 'warn' | 'danger' | 'info';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || action ? (
        <div className="panel__head">
          {title ? <h2 className="panel__title">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StateBox({ icon, title, text, tone = 'neutral', action, role }: { icon: IconName; title: string; text?: string; tone?: 'neutral' | 'error'; action?: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div className={`state ${tone === 'error' ? 'state--error' : ''}`} role={role ?? (tone === 'error' ? 'alert' : 'status')}>
      <Icon name={icon} size={32} />
      <h2 className="state__title">{title}</h2>
      {text ? <p className="state__text">{text}</p> : null}
      {action}
    </div>
  );
}

export async function EmptyState({ title, text, action }: { title?: string; text?: string; action?: ReactNode }) {
  const { t } = await getI18n();
  return <StateBox icon="info" title={title ?? t('state.empty')} text={text ?? t('state.emptyText')} action={action} />;
}

export async function ErrorState({ error }: { error: ApiError }) {
  const { t } = await getI18n();
  if (error.forbidden) return <StateBox icon="lock" tone="error" title={t('state.forbidden')} text={t('state.forbiddenText')} />;
  return (
    <StateBox
      icon="alert"
      tone="error"
      title={t('state.error')}
      text={error.status === 429 ? t('state.rateLimited') : t('state.errorText')}
      action={<RetryLink />}
    />
  );
}

async function RetryLink() {
  const { t } = await getI18n();
  // A plain link to the same page: server components re-run their data calls on every request.
  return (
    <a className="btn btn--ghost btn--sm" href="">
      {t('common.retry')}
    </a>
  );
}

export async function Forbidden() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t('state.forbidden')} />
      <StateBox icon="lock" tone="error" title={t('state.forbidden')} text={t('state.forbiddenText')} action={<Link className="btn btn--ghost btn--sm" href="/">{t('nav.dashboard')}</Link>} />
    </>
  );
}

// ---------------------------------------------------------------- data table

export type Column<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** The first, most important cell: becomes the card title on phones. */
  primary?: boolean;
  align?: 'end';
  className?: string;
};

export function DataTable<Row>({ caption, columns, rows, rowKey, rowClass }: { caption: string; columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; rowClass?: (row: Row) => string | undefined }) {
  return (
    // Scrollable when wide: it must be reachable with the keyboard (and named for screen readers).
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'end' ? 'is-end' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClass?.(row)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={[c.primary ? 'is-primary' : '', c.align === 'end' ? 'is-end' : '', c.key === 'actions' ? 'cell-actions' : '', c.className ?? ''].join(' ').trim() || undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- list toolbar and pagination

type Params = Record<string, string | number | undefined>;

export function hrefWith(base: string, params: Params): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) sp.set(key, String(value));
  }
  const text = sp.toString();
  return text ? `${base}?${text}` : base;
}

/** The URL parameters of a list that differ from the defaults, for links that keep the current view. */
export function paramsOf(p: { page: number; size: number; q: string; status: string; sort: string }, defaultSort = ''): Params {
  return { page: p.page > 1 ? p.page : undefined, size: p.size !== 25 ? p.size : undefined, q: p.q || undefined, status: p.status || undefined, sort: p.sort && p.sort !== defaultSort ? p.sort : undefined };
}

export async function ListToolbar({
  action,
  q,
  status,
  statuses,
  sort,
  sorts,
  hidden = {},
  exportPath,
  extra,
  searchLabel,
}: {
  action: string;
  q: string;
  status?: string;
  statuses?: { value: string; label: string }[];
  sort?: string;
  sorts?: { value: string; label: string }[];
  hidden?: Params;
  exportPath?: string;
  extra?: ReactNode;
  searchLabel?: string;
}) {
  const { t } = await getI18n();
  const filtered = Boolean(q || status || (sort && sorts && sort !== sorts[0]?.value));
  return (
    <form className="toolbar" method="get" action={action} role="search" aria-label={searchLabel ?? t('common.search')}>
      {Object.entries(hidden).map(([k, v]) => (v !== undefined && v !== '' ? <input key={k} type="hidden" name={k} value={String(v)} /> : null))}
      <div className="toolbar__search">
        <label className="visually-hidden" htmlFor="q">{searchLabel ?? t('common.search')}</label>
        <Icon name="search" size={18} />
        <input id="q" name="q" type="search" className="input" defaultValue={q} placeholder={searchLabel ?? t('common.search')} maxLength={100} autoComplete="off" />
      </div>
      {statuses ? (
        <div className="toolbar__select">
          <label className="visually-hidden" htmlFor="status">{t('common.status')}</label>
          <select id="status" name="status" className="select" defaultValue={status ?? ''}>
            <option value="">{t('common.allStatuses')}</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}
      {sorts ? (
        <div className="toolbar__select">
          <label className="visually-hidden" htmlFor="sort">{t('common.sort')}</label>
          <select id="sort" name="sort" className="select" defaultValue={sort || sorts[0]?.value}>
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}
      <button type="submit" className="btn btn--gold btn--sm">{t('common.apply')}</button>
      {filtered ? <Link className="btn btn--ghost btn--sm" href={hrefWith(action, hidden)}>{t('common.reset')}</Link> : null}
      <div className="toolbar__spacer" />
      {extra}
      {exportPath ? (
        <a className="btn btn--ghost btn--sm" href={exportPath} download>
          <Icon name="download" size={16} />
          <span>{t('common.exportCsv')}</span>
        </a>
      ) : null}
    </form>
  );
}

export async function Pagination({ base, page, size, total, params }: { base: string; page: number; size: number; total: number; params: Params }) {
  const { t } = await getI18n();
  const pages = Math.max(1, Math.ceil(total / size));
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const link = (p: number) => hrefWith(base, { ...params, page: p === 1 ? undefined : p });
  return (
    <nav className="pager" aria-label={t('common.pagination')}>
      <p className="pager__info" aria-live="polite">{t('common.showing', { from, to, total })}</p>
      <div className="pager__links">
        {page > 1 ? (
          <Link className="btn btn--ghost btn--sm" href={link(page - 1)} rel="prev">
            <Icon name="chevronLeft" size={16} className="icon flip-rtl" />
            <span>{t('common.previous')}</span>
          </Link>
        ) : (
          <span className="btn btn--ghost btn--sm is-disabled" aria-disabled="true">
            <Icon name="chevronLeft" size={16} className="icon flip-rtl" />
            <span>{t('common.previous')}</span>
          </span>
        )}
        <span className="pager__page">{t('common.pageOf', { page, pages })}</span>
        {page < pages ? (
          <Link className="btn btn--ghost btn--sm" href={link(page + 1)} rel="next">
            <span>{t('common.next')}</span>
            <Icon name="chevronRight" size={16} className="icon flip-rtl" />
          </Link>
        ) : (
          <span className="btn btn--ghost btn--sm is-disabled" aria-disabled="true">
            <span>{t('common.next')}</span>
            <Icon name="chevronRight" size={16} className="icon flip-rtl" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** A label/value pair inside a detail drawer. */
export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field-row ${wide ? 'field-row--wide' : ''}`.trim()}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Latin text (e-mail, phone, ids) keeps its own direction inside Hebrew and Arabic text. */
export function Ltr({ children }: { children: ReactNode }) {
  return <bdi className="ltr">{children}</bdi>;
}
