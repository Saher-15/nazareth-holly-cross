import type { Metadata } from 'next';
import { Badge, Field, Panel, PageHeader } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { can, type Capability } from '@/lib/roles';
import { getSession } from '@/lib/server-api';
import { SignOutEverywhere } from './SignOutEverywhere';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.profile') };
}

const ABILITIES: { cap: Capability | 'read'; key: 'profile.canRead' | 'profile.canWrite' | 'profile.canDeleteOrders' | 'profile.canUsers' | 'profile.canAudit' }[] = [
  { cap: 'read', key: 'profile.canRead' },
  { cap: 'write', key: 'profile.canWrite' },
  { cap: 'deleteOrders', key: 'profile.canDeleteOrders' },
  { cap: 'manageUsers', key: 'profile.canUsers' },
  { cap: 'viewAudit', key: 'profile.canAudit' },
];

export default async function ProfilePage() {
  const { t, locale } = await getI18n();
  const { user, expiresAt } = await getSession();
  return (
    <>
      <PageHeader title={t('nav.profile')} description={t('profile.lead')} />
      <div className="grid grid--two grid--top">
        <Panel title={t('profile.account')}>
          <dl className="fields">
            <Field label={t('users.username')}>{user.username}</Field>
            <Field label={t('users.role')}><Badge tone="gold">{t(`role.${user.role}`)}</Badge></Field>
            <Field label={t('users.twoFactor')}>{user.totpEnabled ? <Badge tone="success">{t('common.on')}</Badge> : <Badge tone="warn">{t('common.off')}</Badge>}</Field>
            <Field label={t('users.lastLogin')}>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, locale) : t('users.never')}</Field>
          </dl>
          <h3 className="drawer__subtitle">{t('profile.abilities')}</h3>
          <ul className="checks">
            {ABILITIES.map((a) => {
              const ok = a.cap === 'read' ? true : can(user.role, a.cap);
              return (
                <li key={a.key} className={ok ? 'checks__item is-yes' : 'checks__item is-no'}>
                  <span className="visually-hidden">{ok ? t('common.yes') : t('common.no')}: </span>
                  <span aria-hidden="true">{ok ? '✓' : '✕'}</span> {t(a.key)}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title={t('profile.session')}>
          <dl className="fields">
            <Field label={t('profile.expires')}>{expiresAt ? formatDateTime(new Date(expiresAt).toISOString(), locale) : '-'}</Field>
            <Field label={t('profile.idle')}>{t('profile.idleValue')}</Field>
            <Field label={t('profile.storage')} wide>{t('profile.storageValue')}</Field>
          </dl>
          <p className="hint">{t('profile.sessionNote')}</p>
          <SignOutEverywhere />
        </Panel>
      </div>
    </>
  );
}
