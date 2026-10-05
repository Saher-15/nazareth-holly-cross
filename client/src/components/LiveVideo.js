import React, { useEffect, useState } from 'react';
import "../styles/FaithShared.css";
import "../styles/LiveClient.css";
import { useTranslation } from 'react-i18next';
import PageHero from './ui/PageHero';
import Reveal from './ui/Reveal';

// Define events with a specific start time in local timezone (Israel Time)
const events = [
  { dateTime: new Date('2024-10-06T09:00:00+03:00'), description: 'Sunday Prayer from the Annunciation church' },
];

const pastVideos = [
  {
    titleKey: 'videos.interview_nazareth.title',
    descriptionKey: 'videos.interview_nazareth.description',
    src: 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Finterview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6',
    thumbnail: 'images/interview.jpg'
  },
  {
    titleKey: 'videos.live_prayer_latin.title',
    descriptionKey: 'videos.live_prayer_latin.description',
    src: 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Flive-17-9-24.mp4?alt=media&token=9bbb1fe2-4439-497c-adf6-038697cde4e0',
    thumbnail: 'images/live-17-9-24.jpg'
  }
];

const STATUS_LABEL = {
  live: 'faithUi.liveBadge',
  upcoming: 'faithUi.upcomingBadge',
  offline: 'faithUi.offlineBadge',
};

const LiveVideo = () => {
  const { t } = useTranslation(); // Initialize translation hook
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [pastEvents, setPastEvents] = useState([]); // eslint-disable-line no-unused-vars
  const [timeRemaining, setTimeRemaining] = useState('');
  const [inLiveMode, setInLiveMode] = useState(false);
  const [canJoinLive, setCanJoinLive] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const now = new Date();

    const upcomingEvents = events.filter(event => new Date(event.dateTime) >= now);
    const endedEvents = events.filter(event => new Date(event.dateTime) < now);

    setPastEvents(endedEvents.sort((a, b) => b.dateTime - a.dateTime));

    const mostUpcomingEvent = upcomingEvents.sort((a, b) => a.dateTime - b.dateTime)[0] || null;

    if (!mostUpcomingEvent) {
      const liveEvents = events.filter(event => {
        const eventDateTime = new Date(event.dateTime);
        const eventEndTime = new Date(eventDateTime.getTime() + 2 * 60 * 60 * 1000);
        return now >= eventDateTime && now <= eventEndTime;
      });

      if (liveEvents.length > 0) {
        setUpcomingEvent(liveEvents[0]);
        setInLiveMode(true);
        setCanJoinLive(true);
      }
    } else {
      setUpcomingEvent(mostUpcomingEvent);
    }

    if (!upcomingEvent) {
      setInLiveMode(false);
      setCanJoinLive(false);
    }

  }, [upcomingEvent]);

  useEffect(() => {
    if (upcomingEvent) {
      const calculateTimeRemaining = () => {
        const now = new Date();
        const eventDateTime = new Date(upcomingEvent.dateTime);
        const timeDiff = eventDateTime - now;

        if (timeDiff <= 0) {
          setTimeRemaining(t('faithUi.eventStarted')); // live.event_has_started never existed in the locales
          return;
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      };

      const interval = setInterval(calculateTimeRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [t, upcomingEvent]);

  const handleJoinLive = () => {
    window.open('https://www.instagram.com/nazareth_holy_cross/', '_blank');
  };

  const status = inLiveMode ? 'live' : upcomingEvent ? 'upcoming' : 'offline';

  return (
    <main className={`ui-page fx fx-hero-plain fx-live ${inLiveMode ? 'live-mode' : ''}`}>
      <PageHero
        eyebrow={t('faithUi.liveEyebrow')}
        title={t('faithUi.liveTitle')}
        lead={t('faithUi.liveLead')}
      />

      <section className="ui-container fx-stage" aria-labelledby="fx-stage-title">
        <div className={`fx-player fx-player--${status}`}>
          <img className="fx-player__bg" src="/images/latin/latin8.jpg" alt="" />
          <span className="fx-player__shade" aria-hidden="true" />

          <div className="fx-player__top">
            <span className={`fx-badge fx-badge--${status}`}>
              <span className="fx-badge__dot" aria-hidden="true" />
              {t(STATUS_LABEL[status])}
            </span>
            <span className="fx-player__brand" aria-hidden="true">
              <i className="fas fa-broadcast-tower" />
            </span>
          </div>

          <div className="fx-player__body">
            {upcomingEvent ? (
              <>
                <h2 id="fx-stage-title" className="fx-player__title">
                  {inLiveMode ? t('live.event_ongoing') : t('live.upcoming_event')}
                </h2>
                <p className="fx-player__event">{upcomingEvent.description}</p>
                <dl className="fx-player__meta">
                  <div>
                    <dt>{t('live.nazareth_date_time')}</dt>
                    <dd>{new Date(upcomingEvent.dateTime).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>{t('live.time_remaining')}</dt>
                    <dd><span className="fx-countdown" role="timer">{timeRemaining}</span></dd>
                  </div>
                </dl>

                {inLiveMode && (
                  <p className="fx-player__note">
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    {t('live.live_note')}
                  </p>
                )}
                <p className="fx-player__note">
                  <i className="fas fa-redo-alt" aria-hidden="true" />
                  {t('live.refresh_note')}
                </p>

                <button type="button" className="ui-btn ui-btn--gold fx-btn-lg fx-player__join" onClick={handleJoinLive} disabled={!canJoinLive}>
                  <i className="fab fa-instagram" aria-hidden="true" />
                  {t('live.join_live')}
                </button>
              </>
            ) : (
              <>
                <span className="fx-player__icon" aria-hidden="true"><i className="fas fa-video-slash" /></span>
                <h2 id="fx-stage-title" className="fx-player__title">{t('live.no_upcoming_events')}</h2>
                <p className="fx-player__hint">{t('faithUi.offlineHint')}</p>
              </>
            )}
          </div>
        </div>
      </section>

      <Reveal as="section" className="ui-section fx-past" aria-labelledby="fx-past-title">
        <div className="ui-container">
          <header className="fx-head">
            <p className="ui-eyebrow">{t('faithUi.pastEyebrow')}</p>
            <h2 id="fx-past-title" className="ui-h2">{t('live.past_live_events')}</h2>
          </header>
          <ul className="fx-past__grid">
            {pastVideos.map((video, index) => (
              <li key={index} className="fx-past__item ui-glass">
                <div className="fx-past__frame">
                  <video
                    controls
                    playsInline
                    preload="none"
                    poster={video.thumbnail}
                    className="fx-past__video"
                    aria-label={t(video.titleKey)}
                  >
                    <source src={video.src} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="fx-past__body">
                  <h3 className="ui-h3">{t(video.titleKey)}</h3>
                  <p className="ui-muted">{t(video.descriptionKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </main>
  );
};

export default LiveVideo;
