import { notFound } from 'next/navigation';

// Any unknown path inside a language (/en/whatever) renders the localized 404.
export default function CatchAll() {
  notFound();
}
