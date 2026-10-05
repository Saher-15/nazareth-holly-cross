'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiAction } from '@/components/ui/ApiAction';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { formatMoney } from '@/lib/format';
import { isImageUrl, UploadError, uploadEnabled, uploadProductImage } from '@/lib/firebase-upload';
import { parseColors, toBody, validateProduct, type FieldErrors, type ProductValues } from '@/lib/product-form';

type Props = { mode: 'create' | 'edit'; id?: string; uuid: string; initial: ProductValues; canDelete: boolean };

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
  const preview = isImageUrl(value.trim()) ? value.trim() : null;

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
          <p id={`${id}-hint`} className="hint">{uploadEnabled ? hint : t('products.uploadDisabled')}</p>
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
  const [v, setV] = useState<ProductValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const set = <K extends keyof ProductValues>(key: K, value: ProductValues[K]) => setV((cur) => ({ ...cur, [key]: value }));

  const message = (code?: string) => (code ? t(`products.err.${code}` as 'products.err.name') : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateProduct(v);
    setErrors(found);
    setServerError(null);
    const first = Object.keys(found)[0];
    if (first) {
      const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      target?.focus();
      return;
    }
    setBusy(true);
    try {
      const body = toBody(v, uuid);
      if (mode === 'create') await proxyCall({ method: 'POST', path: 'products', body });
      else await proxyCall({ method: 'PUT', path: `products/${id}`, body });
      toast(mode === 'create' ? t('products.createdToast') : t('products.savedToast'), 'success');
      router.push('/products');
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.unauthorized) return;
      setServerError(isApiError(error) && error.status < 500 && error.status !== 429 ? error.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  const priceNumber = Number(v.price);
  const colors = parseColors(v.colors);
  const stockNumber = v.stock.trim() === '' ? null : Number(v.stock);

  return (
    <form ref={formRef} className="product-form" onSubmit={submit} noValidate aria-labelledby="page-title">
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
              <input id={fid('price')} data-field="price" className="input" type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" value={v.price} onChange={(e) => set('price', e.target.value)} required aria-invalid={errors.price ? true : undefined} aria-describedby={errors.price ? fid('price-err') : undefined} />
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
              <input id={fid('category')} data-field="category" className="input" value={v.category} onChange={(e) => set('category', e.target.value)} maxLength={60} list={fid('categories')} aria-describedby={fid('category-hint')} />
              <datalist id={fid('categories')}>
                {['Candles', 'Crosses', 'Rosaries', 'Icons', 'Gifts', 'Ornaments', 'Crafts', 'Jewellery'].map((c) => <option key={c} value={c} />)}
              </datalist>
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
            hint={t('products.imageHint')}
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
                hint={t('products.imageHint')}
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
          <div className="preview__image">{isImageUrl(v.img.trim()) ? <img src={v.img.trim()} alt="" /> : <Icon name="image" size={40} />}</div>
          <p className="preview__name">{v.name.trim() || t('products.previewName')}</p>
          <p className="preview__price">{Number.isFinite(priceNumber) && v.price ? formatMoney(priceNumber, locale) : '-'}</p>
          <p className="preview__meta">
            {v.category.trim() ? <span className="chip">{v.category.trim()}</span> : null}
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
          <button type="button" className="btn btn--ghost" onClick={() => router.push('/products')}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined} data-testid="product-save">
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={18} />}
            <span>{mode === 'create' ? t('products.create') : t('common.save')}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
