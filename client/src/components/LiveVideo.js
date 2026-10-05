import React, { useEffect, useState } from 'react';
import "../styles/LiveClient.css";
import { useTranslation } from 'react-i18next';

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


const LiveVideo = () => {
  const { t } = useTranslation(); // Initialize translation hook
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [pastEvents, setPastEvents] = useState([]);
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
          setTimeRemaining(t('live.event_has_started'));
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

  return (
    <div className={`live-client-container ${inLiveMode ? 'live-mode' : ''}`}>
      <div className="live-client-content">
        <div className="live-client-placeholder">
          {upcomingEvent ? (
            <div className="live-client-event-info">
              <h2>{inLiveMode ? t('live.event_ongoing') : t('live.upcoming_event')}</h2>
              <p className="event-name"><strong>{upcomingEvent.description}</strong></p>
              <p><strong>{t('live.nazareth_date_time')}</strong> {new Date(upcomingEvent.dateTime).toLocaleString()}</p>
              <p><strong>{t('live.time_remaining')}</strong> <span className="time-remaining-frame">{timeRemaining}</span></p>

              {inLiveMode && (
                <p className="live-note" style={{ color: 'red' }}>
                  {t('live.live_note')}
                </p>
              )}
              <p className="refresh-note" style={{ color: 'red' }}>
                {t('live.refresh_note')}
              </p>

              <button className="join-live-button" onClick={handleJoinLive} disabled={!canJoinLive}>
                {t('live.join_live')}
              </button>
            </div>
          ) : (
            <p>{t('live.no_upcoming_events')}</p>
          )}
        </div>

        <div className="past-lives-container">
          <h2 style={{ color: '#ffcc00' }}>{t('live.past_live_events')}</h2>
          <div className="past-videos-gallery">
            {pastVideos.map((video, index) => (
              <div key={index} className="past-live-item">
                <video
                  controls
                  width="100%"
                  height="auto"
                  poster={video.thumbnail}
                  className="past-live-video"
                >
                  <source src={video.src} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <h3>{t(video.titleKey)}</h3>
                <p>{t(video.descriptionKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LiveVideo;
