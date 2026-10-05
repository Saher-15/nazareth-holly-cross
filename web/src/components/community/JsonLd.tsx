// Structured data for search engines. `<` is escaped so text from visitors (review bodies, names)
// can never close the script tag (see node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
