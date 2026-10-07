'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Badge, DataTable, type Tone } from '@/components/ui/DataTable';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError, scheduleDeleteSchema, scheduleItemSchema, type ScheduledBroadcast, type ScheduleList } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { storedLength } from '@/lib/entities';
import { formatDateTime } from '@/lib/format';
import {
  differsFromNazareth, displayStatus, NAZARETH_TIME_ZONE, normalizeLocal, SCHEDULE_DESCRIPTION_MAX, SCHEDULE_TITLE_MAX, scheduleTimeProblem,
  type ScheduleDisplayStatus,
} from '@/lib/schedule';

// Scheduled broadcasts (docs/LIVE.md "Scheduled broadcasts"): a form to announce one (or edit one), typed in NAZARETH
// time whatever this device's clock says (the API converts to UTC), and the list: upcoming ones, live ones and those of
// the last 7 days, soonest first, with Edit, Publish/Unpublish, Cancel/Restore and Delete. A broadcast still
// "scheduled" two hours after its start shows as Missed. "Go live" in the studio can fulfil one.

const STATUS_TONE: Record<ScheduleDisplayStatus, Tone> = { scheduled: 'info', live: 'danger', done: 'neutral', cancelled: 'warn', missed: 'warn' };

type Form = { title: string; when: string; description: string; published: boolean };
type Errors = { title?: string; when?: string; description?: string };
const EMPTY: Form = { title: '', when: '', description: '', published: false };

// This device's time zone: '' while rendering on the server, the browser's own after hydration.
const noSubscribe = () => () => undefined;
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
const serverZone = () => '';

type Props = { initial: ScheduleList; renderedAt: number };

export function LiveSchedule({ initial, renderedAt }: Props) {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const uid = useId();
  const [prev, setPrev] = useState(initial);
  const [items, setItems] = useState(initial.items);
  if (initial !== prev) {
    setPrev(initial);
    setItems(initial.items);
  }
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledBroadcast | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(renderedAt);
  const zone = useSyncExternalStore(noSubscribe, browserZone, serverZone);
  const formHeading = useRef<HTMLHeadingElement>(null);

  // "Missed" depends on the time: the first render uses the server's, then the clock moves on.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (editing) formHeading.current?.focus();
  }, [editing]);

  const timeLocked = Boolean(editing && !['scheduled', 'cancelled'].includes(editing.status));
  const put = (item: ScheduledBroadcast) => setItems((list) => list.map((x) => (x.id === item.id ? item : x)));
  const apiMessage = (e: unknown) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));

  function edit(item: ScheduledBroadcast) {
    setEditing(item);
    setForm({ title: item.title, when: item.startsAtLocal, description: item.description, published: item.published });
    setErrors({});
    setFormError(null);
  }

  function reset() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormError(null);
  }

  function check(values: Form): Errors {
    const found: Errors = {};
    const title = values.title.trim();
    if (!title || storedLength(title) > SCHEDULE_TITLE_MAX) found.title = t('live.sched.err.title');
    if (!timeLocked) {
      const problem = scheduleTimeProblem(values.when, Date.now());
      if (problem) found.when = t(`live.sched.err.${problem}`);
    }
    if (storedLength(values.description.trim()) > SCHEDULE_DESCRIPTION_MAX) found.description = t('live.sched.err.description');
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = check(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    const startsAtLocal = normalizeLocal(form.when);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      published: form.published,
      // A live or finished broadcast keeps its time (the API answers 409 otherwise).
      ...(editing && (timeLocked || startsAtLocal === editing.startsAtLocal) ? {} : { startsAtLocal }),
    };
    setSaving(true);
    try {
      if (editing) {
        const { item } = await proxyCall({ method: 'PATCH', path: `live/schedule/${editing.id}`, body, schema: scheduleItemSchema });
        put(item);
        toast(t('live.sched.saved'), 'success');
      } else {
        const { item } = await proxyCall({ method: 'POST', path: 'live/schedule', body, schema: scheduleItemSchema });
        setItems((list) => [...list, item].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        toast(t('live.sched.created'), 'success');
      }
      reset();
      router.refresh(); // the studio's "Fulfils scheduled broadcast" list
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setFormError(apiMessage(e)); // what was typed stays
    } finally {
      setSaving(false);
    }
  }

  async function change(item: ScheduledBroadcast, body: Record<string, unknown>, done: string, key: string) {
    setBusy(`${item.id}:${key}`);
    try {
      const { item: saved } = await proxyCall({ method: 'PATCH', path: `live/schedule/${item.id}`, body, schema: scheduleItemSchema });
      put(saved);
      toast(done, 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      toast(apiMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function cancel(item: ScheduledBroadcast) {
    const ok = await confirm({ title: t('live.sched.cancelTitle', { title: item.title }), message: t('live.sched.cancelText'), confirmLabel: t('live.sched.cancelConfirm'), tone: 'danger' });
    if (ok) await change(item, { status: 'cancelled' }, t('live.sched.cancelledToast', { title: item.title }), 'status');
  }

  async function remove(item: ScheduledBroadcast) {
    const ok = await confirm({ title: t('live.sched.deleteTitle', { title: item.title }), message: t('live.sched.deleteText'), confirmLabel: t('live.sched.delete'), tone: 'danger' });
    if (!ok) return;
    setBusy(`${item.id}:delete`);
    try {
      await proxyCall({ method: 'DELETE', path: `live/schedule/${item.id}`, schema: scheduleDeleteSchema });
      setItems((list) => list.filter((x) => x.id !== item.id));
      if (editing?.id === item.id) reset();
      toast(t('live.sched.deletedToast'), 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      toast(apiMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const field = (key: keyof Errors) => (errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `${uid}-${key}-hint ${uid}-${key}-err` } : { 'aria-describedby': `${uid}-${key}-hint` });
  const errorLine = (key: keyof Errors) => (errors[key] ? <p id={`${uid}-${key}-err`} className="form__error"><Icon name="alert" size={16} /><span>{errors[key]}</span></p> : null);
  const isBusy = (item: ScheduledBroadcast, key: string) => busy === `${item.id}:${key}`;

  return (
    <section className="panel" aria-labelledby={`${uid}-title`} data-testid="live-schedule">
      <div className="panel__head">
        <h2 id={`${uid}-title`} className="panel__title">{t('live.sched.title')}</h2>
      </div>
      <p className="hint storage-line">{t('live.sched.lead')}</p>

      <form className="sched-form" onSubmit={submit} noValidate aria-labelledby={`${uid}-form-title`} data-testid="sched-form">
        <h3 id={`${uid}-form-title`} ref={formHeading} tabIndex={-1} className="sched-form__title" dir="auto">
          {editing ? t('live.sched.editTitle', { title: editing.title }) : t('live.sched.formTitle')}
        </h3>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={`${uid}-title-input`}>{t('live.sched.fieldTitle')}</label>
            <input
              id={`${uid}-title-input`}
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={SCHEDULE_TITLE_MAX}
              required
              dir="auto"
              autoComplete="off"
              data-testid="sched-title"
              {...field('title')}
            />
            <p id={`${uid}-title-hint`} className="hint">{t('live.sched.titleHint', { n: storedLength(form.title.trim()), max: SCHEDULE_TITLE_MAX })}</p>
            {errorLine('title')}
          </div>
          <div className="field">
            <label htmlFor={`${uid}-when-input`}>{t('live.sched.when')}</label>
            <input
              id={`${uid}-when-input`}
              className="input"
              type="datetime-local"
              step={60}
              value={form.when}
              onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))}
              required
              disabled={timeLocked}
              dir="ltr"
              data-testid="sched-when"
              {...field('when')}
            />
            <p id={`${uid}-when-hint`} className="hint">{timeLocked ? t('live.sched.timeLocked') : t('live.sched.whenHint')}</p>
            {errorLine('when')}
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-description-input`}>{t('live.sched.description')}</label>
          <textarea
            id={`${uid}-description-input`}
            className="textarea"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            maxLength={SCHEDULE_DESCRIPTION_MAX}
            rows={3}
            dir="auto"
            data-testid="sched-description"
            {...field('description')}
          />
          <p id={`${uid}-description-hint`} className="hint hint--end">{t('live.sched.descriptionHint', { n: storedLength(form.description.trim()), max: SCHEDULE_DESCRIPTION_MAX })}</p>
          {errorLine('description')}
        </div>
        <div className="field">
          <button
            type="button"
            role="switch"
            aria-checked={form.published}
            className="switch"
            onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
            aria-describedby={`${uid}-publish-hint`}
            data-testid="sched-publish"
          >
            <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
            <span>{t('live.sched.publish')}</span>
          </button>
          <p id={`${uid}-publish-hint`} className="hint">{t('live.sched.publishHint')}</p>
        </div>
        <div className="form__error" role="alert" data-testid="sched-form-error">
          {formError ? <><Icon name="alert" size={16} /><span>{formError}</span></> : null}
        </div>
        <div className="sched-form__buttons">
          <button type="submit" className="btn btn--gold" disabled={saving} aria-busy={saving || undefined} data-testid="sched-submit">
            {saving ? <span className="spinner" aria-hidden="true" /> : <Icon name={editing ? 'check' : 'clock'} size={16} />}
            <span>{editing ? t('live.sched.save') : t('live.sched.submit')}</span>
          </button>
          {editing ? (
            <button type="button" className="btn btn--ghost" onClick={reset}>{t('live.sched.cancelEdit')}</button>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <p className="hint" data-testid="sched-empty">{t('live.sched.empty')}</p>
      ) : (
        <DataTable
          caption={t('live.sched.title')}
          rows={items}
          rowKey={(s) => s.id}
          rowClass={(s) => (s.status === 'cancelled' ? 'is-muted' : undefined)}
          columns={[
            {
              key: 'title', header: t('live.sched.colTitle'), primary: true,
              cell: (s) => (
                <span>
                  <span className="strong" dir="auto" data-testid="sched-item-title">{s.title}</span>
                  {s.description ? <span className="cell-sub cell-sub--text" dir="auto">{s.description}</span> : null}
                </span>
              ),
            },
            {
              key: 'starts', header: t('live.sched.colStarts'), className: 'cell-nowrap',
              cell: (s) => (
                <span>
                  <span data-testid="sched-item-time">{formatDateTime(s.startsAt, locale, NAZARETH_TIME_ZONE)}</span>
                  {zone && differsFromNazareth(s.startsAt, zone) ? <span className="cell-sub">{t('live.sched.yourTime', { time: formatDateTime(s.startsAt, locale, zone) })}</span> : null}
                </span>
              ),
            },
            {
              key: 'status', header: t('live.sched.colStatus'),
              cell: (s) => {
                const status = displayStatus(s, now);
                return <span data-testid="sched-item-status"><Badge tone={STATUS_TONE[status]}>{t(`live.sched.status.${status}`)}</Badge></span>;
              },
            },
            {
              key: 'website', header: t('live.sched.colWebsite'),
              cell: (s) => <Badge tone={s.published ? 'success' : 'neutral'}>{s.published ? t('live.sched.published') : t('live.sched.draft')}</Badge>,
            },
            {
              key: 'actions', header: t('live.sched.colActions'),
              cell: (s) => (
                <div className="row-actions row-actions--wrap">
                  <button type="button" className="icon-btn" onClick={() => edit(s)} aria-label={t('live.sched.editLabel', { title: s.title })} title={t('live.sched.edit')} data-testid="sched-edit">
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void change(s, { published: !s.published }, t(s.published ? 'live.sched.unpublishedToast' : 'live.sched.publishedToast', { title: s.title }), 'publish')}
                    disabled={isBusy(s, 'publish')}
                    aria-busy={isBusy(s, 'publish') || undefined}
                    aria-label={t(s.published ? 'live.sched.unpublishLabel' : 'live.sched.publishLabel', { title: s.title })}
                    data-testid="sched-toggle-publish"
                  >
                    <Icon name={s.published ? 'eyeOff' : 'eye'} size={16} />
                    <span>{s.published ? t('live.sched.unpublishAction') : t('live.sched.publishAction')}</span>
                  </button>
                  {s.status === 'scheduled' ? (
                    <button type="button" className="btn btn--ghost-danger btn--sm" onClick={() => void cancel(s)} disabled={isBusy(s, 'status')} aria-label={t('live.sched.cancelLabel', { title: s.title })} data-testid="sched-cancel">
                      <Icon name="x" size={16} />
                      <span>{t('live.sched.cancel')}</span>
                    </button>
                  ) : null}
                  {s.status === 'cancelled' ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void change(s, { status: 'scheduled' }, t('live.sched.restoredToast', { title: s.title }), 'status')} disabled={isBusy(s, 'status')} aria-label={t('live.sched.restoreLabel', { title: s.title })} data-testid="sched-restore">
                      <Icon name="check" size={16} />
                      <span>{t('live.sched.restore')}</span>
                    </button>
                  ) : null}
                  {s.status !== 'live' ? (
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => void remove(s)} disabled={isBusy(s, 'delete')} aria-label={t('live.sched.deleteLabel', { title: s.title })} title={t('live.sched.delete')} data-testid="sched-delete">
                      <Icon name="trash" size={18} />
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
