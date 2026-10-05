import { serializeJsonLd, type JsonLd as JsonLdData } from '@/lib/jsonld';

// Structured data for search engines, rendered as a plain <script> per the Next.js guide.
export default function JsonLd({ data }: { data: JsonLdData | readonly JsonLdData[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
