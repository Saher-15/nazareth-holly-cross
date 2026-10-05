import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Mini call-to-action that appears once the hero has scrolled out of view.
function StickyCta({ watchId = 'hx-hero' }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(target);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <Link
      to="/candle"
      className={`hx-sticky ${show ? 'is-visible' : ''}`}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <span className="hx-sticky__flame" aria-hidden="true" />
      {t('home.stickyCandle')}
    </Link>
  );
}

export default StickyCta;
