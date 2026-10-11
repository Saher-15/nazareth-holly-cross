'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiAction } from '@/components/ui/ApiAction';
import { Money } from '@/components/ui/DataTable';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useUnsavedChanges } from '@/components/ui/useUnsavedChanges';
import { useI18n } from '@/i18n/client';
import { isApiError, productWriteSchema } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { clearDraft, loadDraft, saveDraft } from '@/lib/drafts';
import { formatMoney } from '@/lib/format';
import { isImageUrl, isShopImageUrl, PRODUCT_IMAGE_HOSTS, UploadError, uploadEnabled, uploadProductImage } from '@/lib/firebase-upload';
import { CATEGORIES, parseColors, parsePrice, priceJump, toBody, validateProduct, type FieldErrors, type ProductValues } from '@/lib/product-form';

type Props = { mode: 'create' | 'edit'; id?: string; uuid: string; initial: ProductValues; canDelete: boolean };

const sameValues = (a: ProductValues, b: ProductValues) => JSON.stringify(a) === JSON.stringify(b);
const TEXT_FIELDS = ['name', 'price', 'description', 'category', 'stock', 'rate', 'colors', 'img'] as const;
const isProductValues = (value: unknown): value is ProductValues => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return TEXT_FIELDS.every((k) => typeof v[k] === 'string') && Array.isArray(v.additional) && v.additional.every((u) => typeof u === 'string');
};
/** The host of an address, for the "the website cannot show photos from ..." warning. */
const hostOf = (value: string) => {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

function ImageField({
  label,
  hint,
  value,
  onChange,
  error,
  folder,
  fileName,
  required,
  onRemove,
  id,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  folder: string;
  fileName: string;
  required?: boolean;
  onRemove?: () => void;
  id: string;
}) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const trimmed = value.trim();
  // The dashboard's own CSP shows only the hosts the website can show: anything else would be a broken picture here too.
  const preview = isShopImageUrl(trimmed) ? trimmed : null;
  const foreign = isImageUrl(trimmed) && !isShopImageUrl(trimmed);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      // The main image is named like its folder (as the old admin did); extra ones get a time suffix so a replaced photo gets a new address.
      const name = fileName === folder ? fileName : `${fileName}-${Date.now().toString(36)}`;
      onChange(await uploadProductImage(file, folder, name));
      toast(t('products.uploaded'), 'success');
    } catch (e) {
      const reason = e instanceof UploadError ? e.reason : 'failed';
      toast(reason === 'type' ? t('products.uploadType') : reason === 'size' ? t('products.uploadSize') : t('products.uploadFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field image-field">
      <label htmlFor={id}>{label}{required ? <span className="req" aria-hidden="true"> *</span> : null}</label>
      <div className="image-field__row">
        <div className="image-field__thumb" aria-hidden="true">
          {preview ? <img src={preview} alt="" /> : <Icon name="image" size={28} />}
        </div>
        <div className="image-field__inputs">
          <input
            id={id}
            className="input"
            type="url"
            inputMode="url"
            dir="ltr"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('products.imageUrlPlaceholder')}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-err` : ''}`}
            required={required}
          />
          <div className="image-field__buttons">
            {uploadEnabled ? (
              <>
                <input id={`${id}-file`} className="visually-hidden file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={(e) => void pick(e.target.files?.[0])} disabled={busy} />
                <label htmlFor={`${id}-file`} className="btn btn--ghost btn--sm" aria-busy={busy || undefined}>
                  {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="download" size={16} className="icon icon--up" />}
                  <span>{busy ? t('products.uploading') : t('products.upload')}</span>
                </label>
              </>
            ) : null}
            {onRemove ? (
              <button type="button" className="btn btn--ghost-danger btn--sm" onClick={onRemove}>
                <Icon name="trash" size={16} />
                <span>{t('common.remove')}</span>
              </button>
            ) : null}
          </div>
          <p id={`${id}-hint`} className="hint">{uploadEnabled ? hint : t('products.uploadDisabled', { host: PRODUCT_IMAGE_HOSTS[0] })}</p>
          {foreign && !error ? (
            <p className="hint hint--warn" data-testid="image-host-warning"><Icon name="alert" size={16} /> {t('products.imageHostWarning', { host: hostOf(trimmed) })}</p>
          ) : null}
          {error ? <p id={`${id}-err`} className="field__error" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ProductForm({ mode, id, uuid, initial, canDelete }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const { confirm } = useFeedback();
  const [v, setV] = useState<ProductValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  // A field's error goes away as soon as it is changed (it used to stay until the next save).
  const set = <K extends keyof ProductValues>(key: K, value: ProductValues[K]) => {
    setV((cur) => ({ ...cur, [key]: value }));
    setErrors((cur) => (cur[key as keyof FieldErrors] ? { ...cur, [key]: undefined } : cur));
  };

  // ---- typed work is kept (lib/drafts.ts) and the page asks before it is left (components/ui/useUnsavedChanges.ts)
  const draftKey = mode === 'create' ? 'product:new' : `product:${id}`;
  const dirty = !sameValues(v, initial);
  const { leave, release } = useUnsavedChanges(dirty && !busy);
  useEffect(() => {
    // A copy this tab kept (the sign-in ended while typing, or the page was left): offered back once, at the start.
    const draft = loadDraft(draftKey, isProductValues);
    if (!draft || sameValues(draft, initial)) return;
    const restore = window.setTimeout(() => {
      setV(draft);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [draftKey, initial]);
  useEffect(() => {
    if (dirty) saveDraft(draftKey, v);
    else clearDraft(draftKey);
  }, [dirty, draftKey, v]);

  function discardRestored() {
    clearDraft(draftKey);
    setV(initial);
    setErrors({});
    setRestored(false);
  }

  async function cancel() {
    if (await leave('/products')) clearDraft(draftKey);
  }

  const message = (code?: string) => (code ? t(`products.err.${code}` as 'products.err.name') : undefined);
  const savedPrice = (() => {
    const p = parsePrice(initial.price);
    return mode === 'edit' && 'value' in p ? p.value : null;
  })();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateProduct(v, mode === 'edit' ? initial : undefined);
    setErrors(found);
    setServerError(null);
    const first = Object.keys(found)[0];
    if (first) {
      const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      target?.focus();
      return;
    }
    const body = toBody(v, uuid);
    // A price three times higher or lower than before (or a new one of 1,000 or more): a slip of a key is likely.
    if (priceJump(savedPrice, body.price)) {
      const ok = await confirm({
        title: t('products.priceCheckTitle', { price: formatMoney(body.price, locale) }),
        message: savedPrice === null ? t('products.priceCheckNew') : t('products.priceCheckText', { before: formatMoney(savedPrice, locale), after: formatMoney(body.price, locale) }),
        confirmLabel: t('products.priceCheckConfirm'),
        tone: 'primary',
      });
      if (!ok) {
        formRef.current?.querySelector<HTMLElement>('[data-field="price"]')?.focus();
        return;
      }
    }
    setBusy(true);
    try {
      const answer = mode === 'create'
        ? await proxyCall({ method: 'POST', path: 'products', body, schema: productWriteSchema })
        : await proxyCall({ method: 'PUT', path: `products/${id}`, body, schema: productWriteSchema });
      // Honest about the website: "now" only when the site confirmed its refresh (docs/ADMIN.md 4.2).
      const now = answer.siteRefresh === 'done';
      toast(mode === 'create' ? t(now ? 'products.createdLive' : 'products.createdLater') : t(now ? 'products.savedLive' : 'products.savedLater'), 'success');
      clearDraft(draftKey);
      release();
      router.push('/products');
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.unauthorized) return; // the draft is kept: it comes back after the sign-in
      setServerError(isApiError(error) && error.status < 500 && error.status !== 429 ? error.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  const parsedPrice = parsePrice(v.price);
  const colors = parseColors(v.colors);
  const stockNumber = v.stock.trim() === '' ? null : Number(v.stock);

  return (
    <form ref={formRef} className="product-form" onSubmit={submit} noValidate aria-labelledby="page-title">
      {restored ? (
        <div className="alert alert--info product-form__restored" role="status" data-testid="draft-restored">
          <Icon name="info" size={18} />
          <p className="alert__body">
            <span>{t('products.draftRestored')}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={discardRestored}>{t('products.draftDiscard')}</button>
          </p>
        </div>
      ) : null}
      <div className="product-form__main">
        <div className="panel">
          <h2 className="panel__title">{t('products.sectionDetails')}</h2>
          <div className="field">
            <label htmlFor={fid('name')}>{t('products.name')} <span className="req" aria-hidden="true">*</span></label>
            <input id={fid('name')} data-field="name" className="input" value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={200} required aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? fid('name-err') : undefined} autoComplete="off" />
            {errors.name ? <p id={fid('name-err')} className="field__error" role="alert">{message(errors.name)}</p> : null}
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor={fid('price')}>{t('products.price')} <span className="req" aria-hidden="true">*</span></label>
              {/* Text, not type="number": a number field drops a decimal comma ("24,50" became 2450). lib/product-form.ts parsePrice. */}
              <input id={fid('price')} data-field="price" className="input" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} dir="ltr" value={v.price} onChange={(e) => set('price', e.target.value)} required aria-invalid={errors.price ? true : undefined} aria-describedby={`${fid('price-hint')}${errors.price ? ` ${fid('price-err')}` : ''}`} />
              <p id={fid('price-hint')} className="hint">{t('products.priceHint')}</p>
              {errors.price ? <p id={fid('price-err')} className="field__error" role="alert">{message(errors.price)}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={fid('stock')}>{t('products.stock')}</label>
              <input id={fid('stock')} data-field="stock" className="input" type="number" inputMode="numeric" min="0" step="1" value={v.stock} onChange={(e) => set('stock', e.target.value)} aria-describedby={`${fid('stock-hint')}${errors.stock ? ` ${fid('stock-err')}` : ''}`} aria-invalid={errors.stock ? true : undefined} />
              <p id={fid('stock-hint')} className="hint">{t('products.stockHint')}</p>
              {errors.stock ? <p id={fid('stock-err')} className="field__error" role="alert">{message(errors.stock)}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={fid('category')}>{t('products.category')}</label>
              <select id={fid('category')} data-field="category" className="select" value={v.category} onChange={(e) => set('category', e.target.value)} aria-describedby={fid('category-hint')}>
                <option value="">{t('products.categoryAuto')}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}` as 'category.gifts')}</option>)}
              </select>
              <p id={fid('category-hint')} className="hint">{t('products.categoryHint')}</p>
            </div>
            <div className="field">
              <label htmlFor={fid('rate')}>{t('products.rate')}</label>
              <input id={fid('rate')} data-field="rate" className="input" type="number" inputMode="decimal" min="0" max="5" step="0.5" value={v.rate} onChange={(e) => set('rate', e.target.value)} aria-describedby={`${fid('rate-hint')}${errors.rate ? ` ${fid('rate-err')}` : ''}`} aria-invalid={errors.rate ? true : undefined} />
              <p id={fid('rate-hint')} className="hint">{t('products.rateHint')}</p>
              {errors.rate ? <p id={fid('rate-err')} className="field__error" role="alert">{message(errors.rate)}</p> : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor={fid('colors')}>{t('products.colors')}</label>
            <input id={fid('colors')} data-field="colors" className="input" value={v.colors} onChange={(e) => set('colors', e.target.value)} aria-describedby={fid('colors-hint')} autoComplete="off" />
            <p id={fid('colors-hint')} className="hint">{t('products.colorsHint')}</p>
            {errors.colors ? <p className="field__error" role="alert">{message(errors.colors)}</p> : null}
          </div>
          <div className="field">
            <label htmlFor={fid('description')}>{t('products.description')}</label>
            <textarea id={fid('description')} data-field="description" className="textarea" rows={6} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} aria-describedby={`${fid('desc-count')}${errors.description ? ` ${fid('desc-err')}` : ''}`} aria-invalid={errors.description ? true : undefined} />
            <p id={fid('desc-count')} className="hint hint--end">{v.description.length} / 2000</p>
            {errors.description ? <p id={fid('desc-err')} className="field__error" role="alert">{message(errors.description)}</p> : null}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel__title">{t('products.sectionImages')}</h2>
          <ImageField
            id={fid('img')}
            label={t('products.mainImage')}
            hint={t('products.imageHint', { host: PRODUCT_IMAGE_HOSTS[0] })}
            value={v.img}
            onChange={(value) => set('img', value)}
            error={message(errors.img)}
            folder={uuid}
            fileName={uuid}
            required
          />
          <div data-field="additional" tabIndex={-1} className="additional">
            {v.additional.map((url, i) => (
              <ImageField
                key={i}
                id={fid(`extra-${i}`)}
                label={t('products.extraImage', { n: i + 1 })}
                hint={t('products.imageHint', { host: PRODUCT_IMAGE_HOSTS[0] })}
                value={url}
                onChange={(value) => set('additional', v.additional.map((u, j) => (j === i ? value : u)))}
                folder={uuid}
                fileName={`${uuid}-${i + 1}`}
                onRemove={() => set('additional', v.additional.filter((_, j) => j !== i))}
              />
            ))}
            {errors.additional ? <p className="field__error" role="alert">{message(errors.additional)}</p> : null}
            {v.additional.length < 5 ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('additional', [...v.additional, ''])}>
                <Icon name="plus" size={16} />
                <span>{t('products.addImage')}</span>
              </button>
            ) : (
              <p className="hint">{t('products.maxImages')}</p>
            )}
          </div>
        </div>
      </div>

      <aside className="product-form__side" aria-label={t('products.preview')}>
        <div className="panel preview">
          <h2 className="panel__title">{t('products.preview')}</h2>
          <div className="preview__image">{isShopImageUrl(v.img.trim()) ? <img src={v.img.trim()} alt="" /> : <Icon name="image" size={40} />}</div>
          <p className="preview__name">{v.name.trim() || t('products.previewName')}</p>
          <p className="preview__price"><Money>{'value' in parsedPrice ? formatMoney(parsedPrice.value, locale) : '-'}</Money></p>
          <p className="preview__meta">
            {v.category ? <span className="chip">{t(`category.${v.category}` as 'category.gifts')}</span> : null}
            {stockNumber === null ? <span className="chip">{t('products.unlimited')}</span> : <span className={`chip ${stockNumber === 0 ? 'chip--danger' : stockNumber <= 5 ? 'chip--warn' : ''}`}>{stockNumber === 0 ? t('products.outOfStock') : t('products.inStock', { n: stockNumber })}</span>}
          </p>
          {colors.length ? <p className="preview__meta">{colors.map((c) => <span key={c} className="chip">{c}</span>)}</p> : null}
          {v.description.trim() ? <p className="preview__desc">{v.description.trim()}</p> : null}
        </div>
      </aside>

      <div className="product-form__bar">
        <div id="product-form-error" className="form__error" role="alert" aria-live="assertive">
          {serverError ? (
            <>
              <Icon name="alert" size={18} />
              <span>{serverError}</span>
            </>
          ) : null}
        </div>
        <div className="product-form__buttons">
          {mode === 'edit' && canDelete && id ? (
            <ApiAction
              label={t('common.delete')}
              icon="trash"
              tone="danger"
              method="DELETE"
              path={`products/${id}`}
              successText={t('products.deletedToast')}
              then="/products"
              confirm={{ title: t('products.confirmDeleteTitle'), message: t('products.confirmDeleteText', { name: initial.name }), confirmLabel: t('common.delete') }}
            />
          ) : null}
          <span className="toolbar__spacer" />
          <button type="button" className="btn btn--ghost" onClick={() => void cancel()}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined} data-testid="product-save">
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={18} />}
            <span>{mode === 'create' ? t('products.create') : t('common.save')}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
