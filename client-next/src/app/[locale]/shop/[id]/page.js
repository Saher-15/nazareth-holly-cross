import ProductDetailClient from './ProductDetailClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/product/getProductById/${id}`, { cache: 'no-store' });
    const product = await res.json();
    return { title: product?.name || 'Product', description: product?.description?.slice(0, 160) };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductDetailPage({ params }) {
  const { id, locale } = await params;
  let product = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/product/getProductById/${id}`, { cache: 'no-store' });
    product = await res.json();
  } catch (e) {
    console.error('Failed to fetch product:', e.message);
  }
  return <ProductDetailClient product={product} locale={locale} id={id} />;
}
