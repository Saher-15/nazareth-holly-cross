'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '@/i18n/client';
import { formatDay, formatMoney, formatNumber } from '@/lib/format';

// A small accessible chart drawn as SVG (no chart library): bars for a count, an optional line for money on a
// second axis. Keyboard: focus the chart, then Left/Right/Home/End move through the days; the value read-out is a
// live region. A real <table> with the same numbers sits in a <details> for screen readers and for copying.
// Style is set with SVG attributes and CSS classes only, so the strict Content-Security-Policy needs no inline style.

export type DayPoint = { date: string; orders: number; revenue: number; candles: number };

type Props = {
  title: string;
  days: DayPoint[];
  bars: { key: 'orders' | 'candles'; label: string };
  line?: { key: 'revenue'; label: string };
};

/** An axis maximum made of four whole steps of 1, 2 or 5 times a power of ten (so ticks read 0, 1, 2, 3, 4 or 0, 200, ...). */
function niceMax(value: number): number {
  if (value <= 0) return 4;
  const raw = value / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp);
  return step * 4;
}

export function TimeSeriesChart({ title, days, bars, line }: Props) {
  const { t, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(days.length - 1);
  const uid = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = width < 480 ? 190 : 230;
  const padL = 38;
  const padR = line ? 54 : 10;
  const padT = 12;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = Math.max(1, days.length);
  const band = innerW / n;
  const barW = Math.max(3, band * 0.62);

  const barMax = useMemo(() => niceMax(Math.max(0, ...days.map((d) => d[bars.key]))), [days, bars.key]);
  const lineMax = useMemo(() => (line ? niceMax(Math.max(0, ...days.map((d) => d[line.key]))) : 1), [days, line]);

  const yBar = (v: number) => padT + innerH - (v / barMax) * innerH;
  const yLine = (v: number) => padT + innerH - (v / lineMax) * innerH;
  const xCenter = (i: number) => padL + i * band + band / 2;

  const linePath = line ? days.map((d, i) => `${i === 0 ? 'M' : 'L'}${xCenter(i).toFixed(1)} ${yLine(d[line.key]).toFixed(1)}`).join(' ') : '';
  const ticks = [0, 1, 2, 3, 4];
  const current = days[Math.min(active, days.length - 1)] ?? days[0];

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - padL;
    setActive(Math.min(n - 1, Math.max(0, Math.floor(x / band))));
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: n - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, keys[event.key])));
  }

  const readout = current
    ? `${formatDay(current.date, locale)}: ${formatNumber(current[bars.key], locale)} ${bars.label.toLowerCase()}${line ? `, ${formatMoney(current[line.key], locale)}` : ''}`
    : '';
  const total = days.reduce((sum, d) => sum + d[bars.key], 0);

  return (
    <figure className="chart" ref={wrapRef}>
      <figcaption className="chart__legend">
        <span className="legend"><span className="legend__swatch legend__swatch--bar" aria-hidden="true" />{bars.label}</span>
        {line ? <span className="legend"><span className="legend__swatch legend__swatch--line" aria-hidden="true" />{line.label}</span> : null}
      </figcaption>
      <div
        className="chart__plot"
        dir="ltr"
        tabIndex={0}
        role="group"
        aria-label={t('chart.keyboardHint', { title })}
        aria-describedby={`${uid}-readout`}
        onKeyDown={onKey}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('chart.summary', { title, total: formatNumber(total, locale) })} onPointerMove={onPointer} onPointerDown={onPointer}>
          {ticks.map((i) => {
            const y = padT + (innerH / 4) * i;
            return (
              <g key={i}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} className="chart__grid" />
                <text x={padL - 6} y={y + 4} textAnchor="end" className="chart__tick">{formatNumber((barMax / 4) * (4 - i), locale)}</text>
                {line ? (
                  <text x={width - padR + 6} y={y + 4} textAnchor="start" className="chart__tick chart__tick--line">
                    {formatMoney(Math.round((lineMax / 4) * (4 - i)), locale, true)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {days.map((d, i) => (
            <rect
              key={d.date}
              x={xCenter(i) - barW / 2}
              y={yBar(d[bars.key])}
              width={barW}
              height={Math.max(0, padT + innerH - yBar(d[bars.key]))}
              rx={2}
              className={i === active ? 'chart__bar chart__bar--active' : 'chart__bar'}
            />
          ))}
          {line ? <path d={linePath} className="chart__line" fill="none" /> : null}
          {line && current ? <circle cx={xCenter(active)} cy={yLine(current[line.key])} r={4} className="chart__dot" /> : null}
          <line x1={xCenter(active)} x2={xCenter(active)} y1={padT} y2={padT + innerH} className="chart__cursor" />
          {days.map((d, i) =>
            (i % (width < 480 ? 7 : 5) === 0 && n - 1 - i >= (width < 480 ? 4 : 3)) || i === n - 1 ? (
              <text key={d.date} x={xCenter(i)} y={height - 8} textAnchor={i === n - 1 ? 'end' : 'middle'} className="chart__tick">
                {formatDay(d.date, locale)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <p id={`${uid}-readout`} className="chart__readout" aria-live="polite">{readout}</p>
      <details className="chart__data">
        <summary>{t('chart.showTable')}</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={title}>
          <table className="table table--plain">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t('chart.date')}</th>
                <th scope="col" className="is-end">{bars.label}</th>
                {line ? <th scope="col" className="is-end">{line.label}</th> : null}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row" data-label={t('chart.date')}>{formatDay(d.date, locale)}</th>
                  <td className="is-end" data-label={bars.label}>{formatNumber(d[bars.key], locale)}</td>
                  {line ? <td className="is-end" data-label={line.label}>{formatMoney(d[line.key], locale)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
