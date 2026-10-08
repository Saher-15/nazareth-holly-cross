'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError } from '@/lib/api';
import { candleVideoOneSchema, candleVideoUploadSchema, VIDEO_TYPES, type CandleVideo, type CandleVideoList } from '@/lib/candle-videos';
import { proxyCall } from '@/lib/client-api';
import { TusUpload } from '@/lib/tus';

const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;

/** Upload a video for the website's candle page: the file goes straight to Cloudflare Stream (resumable, tus). */
function UploadForm({ list }: { list: CandleVideoList }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (percent !== null) return;
    if (!title.trim()) return setError(t('candleVideos.needTitle'));
    if (!file) return setError(t('candleVideos.needFile'));
    if (!VIDEO_TYPES.includes(file.type)) return setError(t('candleVideos.badType'));
    if (file.size > list.maxBytes) return setError(t('candleVideos.tooBig', { max: megabytes(list.maxBytes) }));
    setError(null);
    setPercent(0);
    try {
      const created = await proxyCall({
        method: 'POST', path: 'candle-videos', body: { title: title.trim(), sizeBytes: file.size, mimeType: file.type }, schema: candleVideoUploadSchema,
      });
      const id = created.video.id;
      const upload = new TusUpload({
        blob: file,
        url: created.uploadUrl,
        renew: async () => (await proxyCall({ method: 'POST', path: `candle-videos/${id}/upload-url`, body: { sizeBytes: file.size }, schema: candleVideoUploadSchema })).uploadUrl,
        onProgress: (sent, total) => setPercent(total ? Math.floor((sent / total) * 100) : 0),
      });
      await upload.run();
      await proxyCall({ method: 'POST', path: `candle-videos/${id}/uploaded`, body: {}, schema: candleVideoOneSchema });
      toast(t('candleVideos.uploaded', { title: title.trim() }), 'success');
      setTitle('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(isApiError(e) && e.status === 503 ? t('candleVideos.notConfigured') : t('candleVideos.uploadFailed'));
    } finally {
      setPercent(null);
    }
  }

  if (list.items.length >= list.max) return <p className="hint">{t('candleVideos.full', { max: list.max })}</p>;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${uid}-title`}>{t('candleVideos.titleLabel')}</label>
        <input id={`${uid}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-file`}>{t('candleVideos.fileLabel')}</label>
        <input
          id={`${uid}-file`} ref={fileRef} className="input" type="file" accept={VIDEO_TYPES.join(',')}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-describedby={`${uid}-help`} required
        />
        <p id={`${uid}-help`} className="hint">{t('candleVideos.fileHelp', { max: megabytes(list.maxBytes) })}</p>
      </div>
      {percent !== null ? (
        <div className="field">
          <label htmlFor={`${uid}-bar`}>{t('candleVideos.progress', { percent })}</label>
          <progress id={`${uid}-bar`} max={100} value={percent} />
        </div>
      ) : null}
      <div className="form__error" role="alert" aria-live="assertive">
        {error ? (<><Icon name="alert" size={18} /><span>{error}</span></>) : null}
      </div>
      <button type="submit" className="btn btn--primary" disabled={percent !== null}>
        {percent !== null ? t('candleVideos.uploading') : t('candleVideos.upload')}
      </button>
    </form>
  );
}

function statusText(t: ReturnType<typeof useI18n>['t'], status: CandleVideo['status']) {
  if (status === 'ready') return t('candleVideos.statusReady');
  if (status === 'processing') return t('candleVideos.statusProcessing');
  if (status === 'failed') return t('candleVideos.statusFailed');
  return t('candleVideos.statusUploading');
}

/** The videos, newest first, with their state at Cloudflare and the publish / delete actions (editor and owner). */
export function CandleVideos({ list, canEdit }: { list: CandleVideoList; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, run: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await run();
      toast(done, 'success');
      router.refresh();
    } catch (e) {
      if (!(isApiError(e) && e.unauthorized)) toast(t('candleVideos.actionFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(v: CandleVideo) {
    const ok = await confirm({ title: t('candleVideos.deleteTitle', { title: v.title }), message: t('candleVideos.deleteText'), confirmLabel: t('candleVideos.delete'), tone: 'danger' });
    if (ok) await act(v.id, () => proxyCall({ method: 'DELETE', path: `candle-videos/${v.id}` }), t('candleVideos.deleted', { title: v.title }));
  }

  return (
    <div className="stack">
      {!list.configured ? <p className="form__error" role="alert">{t('candleVideos.notConfigured')}</p> : null}
      {canEdit && list.configured ? <UploadForm list={list} /> : null}
      {list.items.length === 0 ? (
        <p className="hint">{t('candleVideos.empty')}</p>
      ) : (
        <ul className="stack" aria-label={t('candleVideos.listLabel')}>
          {list.items.map((v) => (
            <li key={v.id} className="panel" data-testid="candle-video">
              <p><strong>{v.title}</strong></p>
              <p className="hint">
                {statusText(t, v.status)}
                {v.durationSeconds ? ` · ${Math.round(v.durationSeconds)} s` : ''}
                {v.createdAt ? ` · ${new Date(v.createdAt).toLocaleDateString(locale)}` : ''}
                {v.published ? ` · ${t('candleVideos.onSite')}` : ''}
              </p>
              {v.failReason ? <p className="hint">{v.failReason}</p> : null}
              {canEdit ? (
                <div className="form__actions">
                  {v.status === 'ready' ? (
                    <button
                      type="button" className="btn" disabled={busy === v.id}
                      onClick={() => act(
                        v.id,
                        () => proxyCall({ method: 'PATCH', path: `candle-videos/${v.id}`, body: { published: !v.published }, schema: candleVideoOneSchema }),
                        v.published ? t('candleVideos.hidden', { title: v.title }) : t('candleVideos.published', { title: v.title }),
                      )}
                    >
                      {v.published ? t('candleVideos.hide') : t('candleVideos.publish')}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn--danger" disabled={busy === v.id} onClick={() => remove(v)}>
                    {t('candleVideos.delete')}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
