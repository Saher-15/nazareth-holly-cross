import { serializeJsonLd } from '@/data/places/seo';

// Structured data for search engines (schema.org), rendered as a plain <script> per the Next.js guide.
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
