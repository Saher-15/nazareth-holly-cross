import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ErrorState, Ltr, PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { productSchema } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { valuesFrom } from '@/lib/product-form';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { ProductForm } from '../ProductForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('products.edit') };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getI18n();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const { user } = await getSession();
  const result = await load(() => serverApi({ path: `/admin/products/${id}`, schema: productSchema }));
  // The API answers 404 for a missing product and 400 for an id that is not an id at all: both are "not found".
  if (!result.ok && (result.error.status === 404 || result.error.status === 400)) notFound();
  const canWrite = can(user.role, 'write');

  return (
    <>
      <PageHeader
        eyebrow={t('nav.products')}
        title={result.ok ? result.data.name : t('products.edit')}
        description={canWrite ? t('products.editLead') : t('products.readOnlyLead')}
        actions={<Link className="btn btn--ghost btn--sm" href="/products">{t('common.back')}</Link>}
      />
      {!result.ok ? (
        <ErrorState error={result.error} />
      ) : canWrite ? (
        <ProductForm mode="edit" id={result.data.id} uuid={result.data.uuidv4_ || crypto.randomUUID()} initial={valuesFrom(result.data)} canDelete />
      ) : (
        <Panel title={t('products.sectionDetails')}>
          <dl className="fields">
            <div className="field-row"><dt>{t('products.price')}</dt><dd>{formatMoney(result.data.price, locale)}</dd></div>
            <div className="field-row"><dt>{t('products.stock')}</dt><dd>{result.data.stock ?? t('products.unlimited')}</dd></div>
            <div className="field-row"><dt>{t('products.category')}</dt><dd>{result.data.category ?? '-'}</dd></div>
            <div className="field-row"><dt>{t('products.rate')}</dt><dd>{result.data.rate ?? 0}</dd></div>
            <div className="field-row"><dt>{t('common.date')}</dt><dd>{formatDateTime(result.data.createdAt, locale)}</dd></div>
            <div className="field-row field-row--wide"><dt>{t('products.description')}</dt><dd>{result.data.description || '-'}</dd></div>
            <div className="field-row field-row--wide"><dt>{t('products.mainImage')}</dt><dd><Ltr>{result.data.img}</Ltr></dd></div>
          </dl>
        </Panel>
      )}
    </>
  );
}
