import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiAction } from '@/components/ui/ApiAction';
import { Drawer } from '@/components/ui/Drawer';
import { Badge, DataTable, EmptyState, ErrorState, Field, hrefWith, ListToolbar, Ltr, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { contactSchema, contactsPage, parseListParams, type Contact } from '@/lib/api';
import { formatDateTime, mailtoHref, truncate } from '@/lib/format';
import { can } from '@/lib/roles';
import { openParam } from '@/lib/search-params';
import { getSession, load, serverApi } from '@/lib/server-api';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.contacts') };
}

const DEFAULT_SORT = '-createdAt';

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const raw = await searchParams;
  const params = parseListParams(raw, { sort: DEFAULT_SORT });
  const open = openParam(raw);
  const keep = paramsOf(params, DEFAULT_SORT);
  const canWrite = can(user.role, 'write');

  const [list, detail] = await Promise.all([
    load(() => serverApi({ path: '/admin/contacts', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: contactsPage })),
    open ? load(() => serverApi({ path: `/admin/contacts/${open}`, schema: contactSchema })) : Promise.resolve(null),
  ]);
  const closeHref = hrefWith('/contacts', keep);

  return (
    <>
      <PageHeader title={t('nav.contacts')} description={t('contacts.lead')} />
      <ListToolbar
        action="/contacts"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'open', label: t('status.open') },
          { value: 'done', label: t('status.done') },
        ]}
        sort={params.sort}
        sorts={[
          { value: '-createdAt', label: t('sort.newest') },
          { value: 'createdAt', label: t('sort.oldest') },
        ]}
        exportPath={can(user.role, 'export') ? '/api/proxy/export/contacts.csv' : undefined}
        searchLabel={t('contacts.search')}
      />

      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={params.q || params.status ? t('state.noResults') : t('contacts.empty')} text={params.q || params.status ? t('state.noResultsText') : ''} />
      ) : (
        <>
          <DataTable<Contact>
            caption={t('nav.contacts')}
            rows={list.data.items}
            rowKey={(c) => c.id}
            columns={[
              {
                key: 'who',
                header: t('contacts.colFrom'),
                primary: true,
                cell: (c) => (
                  <>
                    <Link className="link link--strong" href={hrefWith('/contacts', { ...keep, open: c.id })} scroll={false}>{c.fullName}</Link>
                    <span className="cell-sub"><Ltr>{c.email}</Ltr></span>
                  </>
                ),
              },
              { key: 'msg', header: t('contacts.colMessage'), className: 'cell-wide', cell: (c) => truncate(c.msg, 120) },
              { key: 'date', header: t('common.date'), cell: (c) => formatDateTime(c.createdAt, locale) },
              { key: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.done ? 'success' : 'gold'}>{c.done ? t('status.done') : t('status.open')}</Badge> },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (c) => (
                  <div className="row-actions">
                    <Link className="btn btn--ghost btn--sm" href={hrefWith('/contacts', { ...keep, open: c.id })} scroll={false}>{t('common.view')}</Link>
                    {canWrite && !c.done ? (
                      <ApiAction label={t('common.markDone')} ariaLabel={t('contacts.markDoneFor', { name: c.fullName })} icon="check" method="PATCH" path={`contacts/${c.id}`} body={{ done: true }} tone="gold" successText={t('contacts.doneToast')} />
                    ) : null}
                    {canWrite ? (
                      <ApiAction
                        label={t('common.delete')}
                        ariaLabel={t('contacts.deleteFor', { name: c.fullName })}
                        icon="trash"
                        iconOnly
                        tone="danger"
                        method="DELETE"
                        path={`contacts/${c.id}`}
                        successText={t('contacts.deletedToast')}
                        confirm={{ title: t('contacts.confirmDeleteTitle'), message: t('contacts.confirmDeleteText', { name: c.fullName }), confirmLabel: t('common.delete') }}
                      />
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination base="/contacts" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}

      {open ? (
        <Drawer title={t('contacts.detailTitle')} closeHref={closeHref}>
          {detail && detail.ok ? (
            <>
              <div className="detail-head">
                <div>
                  <p className="detail-head__id">{detail.data.fullName}</p>
                  <p className="muted">{formatDateTime(detail.data.createdAt, locale)}</p>
                </div>
                <Badge tone={detail.data.done ? 'success' : 'gold'}>{detail.data.done ? t('status.done') : t('status.open')}</Badge>
              </div>
              <dl className="fields">
                <Field label={t('common.email')}><a className="link" href={mailtoHref(detail.data.email) ?? undefined}><Ltr>{detail.data.email}</Ltr></a></Field>
                <Field label={t('common.phone')}>{detail.data.phone ? <Ltr>{detail.data.phone}</Ltr> : '-'}</Field>
                <Field label={t('contacts.colMessage')} wide><p className="prose">{detail.data.msg}</p></Field>
              </dl>
              {canWrite ? (
                <div className="drawer__actions">
                  <a className="btn btn--ghost btn--sm" href={mailtoHref(detail.data.email) ?? undefined}>{t('contacts.reply')}</a>
                  {!detail.data.done ? (
                    <ApiAction label={t('common.markDone')} icon="check" method="PATCH" path={`contacts/${detail.data.id}`} body={{ done: true }} tone="gold" successText={t('contacts.doneToast')} />
                  ) : null}
                  <ApiAction
                    label={t('common.delete')}
                    icon="trash"
                    tone="danger"
                    method="DELETE"
                    path={`contacts/${detail.data.id}`}
                    successText={t('contacts.deletedToast')}
                    then={closeHref}
                    confirm={{ title: t('contacts.confirmDeleteTitle'), message: t('contacts.confirmDeleteText', { name: detail.data.fullName }), confirmLabel: t('common.delete') }}
                  />
                </div>
              ) : null}
            </>
          ) : detail && !detail.ok ? (
            <ErrorState error={detail.error} />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
