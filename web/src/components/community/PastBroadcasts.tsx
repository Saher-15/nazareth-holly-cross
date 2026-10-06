import { getImageProps } from 'next/image';
import { useTranslations } from 'next-intl';
import type { RecordingView } from '@/lib/liveRecordings';
import RecordingList from './RecordingList';
import { pastBroadcasts } from './recordings';
import styles from './PastBroadcasts.module.css';

// Past broadcasts on /live, in one list: first the recordings published from the dashboard (Cloudflare Stream,
// newest first: <RecordingList>), then the older recordings kept with the site. Nothing is downloaded until the
// visitor presses play (preload="none"; Cloudflare's player only after a press); the posters of the older ones go
// through the Next image optimiser.
export default function PastBroadcasts({ recordings = [] }: { recordings?: RecordingView[] }) {
  const t = useTranslations();

  return (
    <ul className={styles.grid}>
      <RecordingList initial={recordings} />
      {pastBroadcasts.map((video) => {
        const titleId = `past-${video.id}-title`;
        const { props: poster } = getImageProps({
          src: video.poster.src,
          alt: '',
          width: video.poster.width,
          height: video.poster.height,
        });
        return (
          <li key={video.id} className={`ui-glass ${styles.item}`}>
            <div className={styles.frame}>
              <video
                className={styles.video}
                controls
                playsInline
                preload="none"
                poster={poster.src}
                aria-labelledby={titleId}
              >
                {video.sources.map((source) => (
                  <source key={source.src} src={source.src} type={source.type} />
                ))}
                {t('communityPage.live.videoFallback')}
              </video>
            </div>
            <div className={styles.body}>
              <h3 id={titleId} className="ui-h3">
                {t(`videos.${video.messageKey}.title`)}
              </h3>
              <p className="ui-muted">{t(`videos.${video.messageKey}.description`)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
