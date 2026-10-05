'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SoundOff, SoundOn } from './icons';
import styles from './HomeHero.module.css';

export const HERO_SOUND_URL = '/sounds/Christians.mp3';

// Background music for the hero, off until the visitor turns it on.
export default function SoundToggle() {
  const t = useTranslations('home');
  const [on, setOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(HERO_SOUND_URL);
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;
    if (on) {
      audio.pause();
      setOn(false);
    } else {
      audio.play().catch(() => setOn(false));
      setOn(true);
    }
  };

  return (
    <button type="button" className={styles.sound} onClick={toggle} aria-pressed={on} aria-label={t('soundToggle')}>
      {on ? <SoundOn /> : <SoundOff />}
    </button>
  );
}
