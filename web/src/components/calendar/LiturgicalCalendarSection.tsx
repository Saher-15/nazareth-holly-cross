import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import JsonLd from '@/components/ui/JsonLd';
import Reveal from '@/components/ui/Reveal';
import { broadcastEventsJsonLd, loadBroadcastSchedule } from '@/lib/broadcastSchedule';
import { organizationJsonLd } from '@/lib/jsonLd';
import { nazarethToday } from '@/lib/liturgical';
import { absoluteUrl, localePath } from '@/lib/seo';
import LiturgicalCalendar from './LiturgicalCalendar';
import styles from './LiturgicalCalendar.module.css';

type Props = { locale: string };

// The Christian calendar section of the /live page (docs/LITURGICAL-CALENDAR.md). Rendered on the server: the head,
// the notes on the conventions, the structured data of the scheduled broadcasts; the calendar itself is a client
// component. Its texts (pilgrim.calendar) are handed to that component here, for this page only: they are not part of
// the messages every page sends to the browser (app/[locale]/layout.tsx keeps the pilgrim texts on the server).
export default async function LiturgicalCalendarSection({ locale }: Props) {
  const [t, tSite, messages, broadcasts] = await Promise.all([
    getTranslations('pilgrim.calendar'),
    getTranslations('site'),
    getMessages(),
    loadBroadcastSchedule(),
  ]);
  const calendarMessages = (messages as { pilgrim?: { calendar?: Record<string, unknown> } }).pilgrim?.calendar ?? {};
  const pageUrl = absoluteUrl(localePath(locale, '/live'));

  return (
    <section id="calendar" className="ui-section" aria-labelledby="calendar-title">
      <div className="ui-container">
        <Reveal as="header" className={styles.head}>
          <p className="ui-eyebrow">{t('eyebrow')}</p>
          <h2 id="calendar-title" className="ui-h2">
            {t('title')}
          </h2>
          <p className={styles.lead}>{t('lead')}</p>
        </Reveal>

        <NextIntlClientProvider messages={{ pilgrim: { calendar: calendarMessages } } as AbstractIntlMessages}>
          <LiturgicalCalendar today={nazarethToday()} broadcasts={broadcasts} pageUrl={pageUrl} />
        </NextIntlClientProvider>

        <div className={styles.notes}>
          <h3 id="calendar-notes-title" className={styles.notesTitle}>
            {t('notes.title')}
          </h3>
          <ul>
            <li>{t('notes.catholic')}</li>
            <li>{t('notes.holyLand')}</li>
            <li>{t('notes.orthodox')}</li>
            <li>{t('notes.computed')}</li>
          </ul>
        </div>
      </div>
      {broadcasts.length > 0 && (
        <JsonLd data={broadcastEventsJsonLd(broadcasts, { locale, pageUrl, organizer: organizationJsonLd({ name: tSite('name') }) })} />
      )}
    </section>
  );
}
