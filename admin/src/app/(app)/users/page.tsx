import type { Metadata } from 'next';
import { ApiAction } from '@/components/ui/ApiAction';
import { Badge, DataTable, EmptyState, ErrorState, Forbidden, ListToolbar, PageHeader, Pagination, paramsOf } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { parseListParams, usersPage, type AdminUser } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { CreateUser, RecoveryEmail, RoleSelect } from './UserControls';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.users') };
}

const DEFAULT_SORT = 'username';

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  if (!can(user.role, 'manageUsers')) return <Forbidden />;
  const params = parseListParams(await searchParams, { sort: DEFAULT_SORT });
  const keep = paramsOf(params, DEFAULT_SORT);
  const list = await load(() => serverApi({ path: '/admin/users', query: { page: params.page, size: params.size, q: params.q, status: params.status, sort: params.sort }, schema: usersPage }));

  return (
    <>
      <PageHeader title={t('nav.users')} description={t('users.lead')} actions={<CreateUser />} />
      <ListToolbar
        action="/users"
        q={params.q}
        status={params.status}
        statuses={[
          { value: 'active', label: t('status.active') },
          { value: 'disabled', label: t('status.disabled') },
        ]}
        searchLabel={t('users.search')}
      />
      {!list.ok ? (
        <ErrorState error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={t('state.noResults')} text={t('state.noResultsText')} />
      ) : (
        <>
          <DataTable<AdminUser>
            caption={t('nav.users')}
            rows={list.data.items}
            rowKey={(u) => u.id}
            rowClass={(u) => (u.disabled ? 'is-muted' : undefined)}
            columns={[
              {
                key: 'name',
                header: t('users.username'),
                primary: true,
                cell: (u) => (
                  <>
                    <span className="strong">{u.username}</span>
                    {u.id === user.id ? <Badge tone="gold">{t('users.you')}</Badge> : null}
                  </>
                ),
              },
              { key: 'email', header: t('users.email'), cell: (u) => <RecoveryEmail id={u.id} username={u.username} email={u.email ?? ''} /> },
              { key: 'role', header: t('users.role'), cell: (u) => <RoleSelect id={u.id} username={u.username} role={u.role} disabled={u.id === user.id} /> },
              { key: 'twofa', header: t('users.twoFactor'), cell: (u) => (u.totpEnabled ? <Badge tone="success">{t('common.on')}</Badge> : <Badge tone="neutral">{t('common.off')}</Badge>) },
              { key: 'last', header: t('users.lastLogin'), cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : t('users.never')) },
              { key: 'status', header: t('common.status'), cell: (u) => <Badge tone={u.disabled ? 'danger' : 'success'}>{u.disabled ? t('status.disabled') : t('status.active')}</Badge> },
              {
                key: 'actions',
                header: t('common.actions'),
                align: 'end',
                cell: (u) =>
                  u.id === user.id ? (
                    <span className="muted">-</span>
                  ) : (
                    <div className="row-actions">
                      <ApiAction
                        label={u.disabled ? t('users.enable') : t('users.disable')}
                        ariaLabel={u.disabled ? t('users.enableFor', { name: u.username }) : t('users.disableFor', { name: u.username })}
                        icon={u.disabled ? 'check' : 'lock'}
                        method="PATCH"
                        path={`users/${u.id}`}
                        body={{ disabled: !u.disabled }}
                        successText={u.disabled ? t('users.enabledToast', { name: u.username }) : t('users.disabledToast', { name: u.username })}
                        confirm={
                          u.disabled
                            ? undefined
                            : { title: t('users.confirmDisableTitle'), message: t('users.confirmDisableText', { name: u.username }), confirmLabel: t('users.disable') }
                        }
                      />
                      <ApiAction
                        label={t('common.delete')}
                        ariaLabel={t('users.deleteFor', { name: u.username })}
                        icon="trash"
                        iconOnly
                        tone="danger"
                        method="DELETE"
                        path={`users/${u.id}`}
                        successText={t('users.deletedToast', { name: u.username })}
                        confirm={{ title: t('users.confirmDeleteTitle'), message: t('users.confirmDeleteText', { name: u.username }), confirmLabel: t('common.delete') }}
                      />
                    </div>
                  ),
              },
            ]}
          />
          <Pagination base="/users" page={list.data.page} size={list.data.size} total={list.data.total} params={keep} />
        </>
      )}
    </>
  );
}
