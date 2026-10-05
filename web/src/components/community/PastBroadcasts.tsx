import { getImageProps } from 'next/image';
import { useTranslations } from 'next-intl';
import { pastBroadcasts } from './recordings';
import styles from './PastBroadcasts.module.css';

// Recordings of past broadcasts. Nothing is downloaded until the visitor presses play (preload="none");
// the posters go through the Next image optimiser.
export default function PastBroadcasts() {
  const t = useTranslations();

  return (
    <ul className={styles.grid}>
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
                <source src={video.src} type="video/mp4" />
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
