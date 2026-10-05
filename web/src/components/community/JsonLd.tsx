import { serializeJsonLd } from '@/lib/jsonLd';

// Structured data for search engines. serializeJsonLd escapes `<`, `>`, `&` and U+2028/2029, so text from
// visitors (review bodies, names) can never close the script tag.
export { serializeJsonLd };

export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
