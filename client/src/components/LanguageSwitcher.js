import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage as changeI18nLanguage } from '../i18n';
import '../styles/LanguageSwitcher.css';

// Every language the site ships, by its own (native) name.
const LANGUAGE_NAMES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'pl', name: 'Polski' },
];

const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2);
  const currentName = (LANGUAGE_NAMES.find((l) => l.code === current) || LANGUAGE_NAMES[0]).name;

  // Keep <html lang> in step with the chosen language (screen readers, hyphenation).
  useEffect(() => {
    document.documentElement.setAttribute('lang', current);
  }, [current]);

  const close = (returnFocus) => {
    setIsOpen(false);
    if (returnFocus && buttonRef.current) buttonRef.current.focus();
  };

  const changeLanguage = (lng) => {
    changeI18nLanguage(lng).catch((err) => console.error('Could not load language', lng, err));
    close(true);
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Close when clicking anywhere outside the switcher.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // On open, put focus on the current language so arrows/Enter work at once.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const active = listRef.current.querySelector('[aria-current="true"]');
    if (active) active.focus();
  }, [isOpen]);

  const options = () => (listRef.current ? [...listRef.current.querySelectorAll('button')] : []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      // Stop here so an open mobile menu behind the popover stays open.
      e.stopPropagation();
      close(true);
      return;
    }
    if (!isOpen) return;
    const items = options();
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[(index + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  // Tabbing out of the switcher closes it.
  const handleBlur = (e) => {
    if (isOpen && rootRef.current && e.relatedTarget && !rootRef.current.contains(e.relatedTarget)) {
      setIsOpen(false);
    }
  };

  return (
    <div className="lang-switch" ref={rootRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="lang-switch__button"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-controls="lang-switch-list"
      >
        <i className="fas fa-globe lang-switch__globe" aria-hidden="true" />
        <span className="lang-switch__sr">{t('shell.language')}: </span>
        <span className="lang-switch__code">{current.toUpperCase()}</span>
        <span className="lang-switch__sr"> ({currentName})</span>
        <i className="fas fa-chevron-down lang-switch__chevron" aria-hidden="true" />
      </button>

      <div
        id="lang-switch-list"
        className={`lang-switch__popover${isOpen ? ' is-open' : ''}`}
        hidden={!isOpen}
      >
        <p className="lang-switch__title" aria-hidden="true">{t('shell.chooseLanguage')}</p>
        <ul className="lang-switch__list" ref={listRef} aria-label={t('shell.chooseLanguage')}>
          {LANGUAGE_NAMES.map(({ code, name }) => {
            const active = code === current;
            return (
              <li key={code}>
                <button
                  type="button"
                  lang={code}
                  className={`lang-switch__option${active ? ' is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => changeLanguage(code)}
                >
                  <span className="lang-switch__name">{name}</span>
                  <span className="lang-switch__meta" aria-hidden="true">
                    {active ? <i className="fas fa-check" /> : code.toUpperCase()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
