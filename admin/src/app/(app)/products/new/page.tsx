import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden, PageHeader } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { EMPTY_PRODUCT } from '@/lib/product-form';
import { can } from '@/lib/roles';
import { getSession } from '@/lib/server-api';
import { ProductForm } from '../ProductForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('products.add') };
}

export default async function NewProductPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  if (!can(user.role, 'write')) return <Forbidden />;
  return (
    <>
      <PageHeader
        eyebrow={t('nav.products')}
        title={t('products.add')}
        description={t('products.addLead')}
        actions={<Link className="btn btn--ghost btn--sm" href="/products">{t('common.back')}</Link>}
      />
      <ProductForm mode="create" uuid={crypto.randomUUID()} initial={EMPTY_PRODUCT} canDelete={false} />
    </>
  );
}
