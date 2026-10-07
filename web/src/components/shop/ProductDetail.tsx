'use client';

import { useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MAX_LINE_QUANTITY, useCart } from '@/lib/cart';
import ImageZoom from './ImageZoom';
import QuantityStepper from './QuantityStepper';
import ShopIcon from './ShopIcon';
import { imageForVariant, isInStock, maxAddable, variantKind } from './catalog';
import styles from './ProductDetail.module.css';

export type DetailProduct = {
  _id: string;
  name: string;
  price: number;
  img: string;
  additionalImageUrls: string[];
  color: string[];
  stock: number | null;
};

type Props = {
  product: DetailProduct;
  /** Server-rendered eyebrow, title, price and description. */
  header: ReactNode;
  /** Server-rendered note under the buy box (shipping). */
  footer?: ReactNode;
};

const ADDED_FLASH_MS = 2500;

// Gallery + variant chips + quantity + add to cart. Picking a colour shows its photo,
// and picking a photo that belongs to a colour selects that colour (as on the old site).
export default function ProductDetail({ product, header, footer }: Props) {
  const t = useTranslations('shopPage');
  const tProduct = useTranslations('product');
  const tCart = useTranslations('cart');
  const { lines, dispatch } = useCart();

  const images = [product.img, ...product.additionalImageUrls];
  const kind = variantKind(product.color);

  const [image, setImage] = useState(0);
  const [variant, setVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [message, setMessage] = useState<'added' | 'chooseVariant' | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const firstChip = useRef<HTMLInputElement>(null);

  const colourValue = variant === null ? '' : product.color[variant];
  const inCart = lines.find((l) => l._id === product._id && l.color === colourValue)?.quantity ?? 0;
  const available = isInStock(product.stock);
  const addable = maxAddable(product.stock, inCart, MAX_LINE_QUANTITY);
  const qty = Math.min(quantity, Math.max(1, addable));
  const currentSrc = images[image] ?? product.img;

  const selectImage = (index: number) => {
    setImage(index);
    if (!kind) return;
    if (index === 0) setVariant(null);
    else if (index - 1 < product.color.length) chooseVariant(index - 1, false);
  };

  function chooseVariant(index: number, showPhoto = true) {
    setVariant(index);
    setQuantity(1);
    if (message === 'chooseVariant') setMessage(null);
    if (showPhoto && images[index + 1]) setImage(index + 1);
  }

  const addToCart = () => {
    if (!available || addable === 0) return;
    if (kind && variant === null) {
      setMessage('chooseVariant');
      firstChip.current?.focus();
      return;
    }
    dispatch({
      type: 'add',
      line: {
        _id: product._id,
        name: product.name,
        price: product.price,
        img: imageForVariant(product, variant),
        color: colourValue,
      },
      quantity: qty,
    });
    setQuantity(1);
    setMessage('added');
    setJustAdded(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setJustAdded(false), ADDED_FLASH_MS);
  };

  const variantLabel = (value: string, index: number) =>
    kind === 'colour' ? t('colourName', { n: index + 1, name: value }) : t('designName', { name: value });

  return (
    <div className={styles.layout}>
      <div className={styles.gallery}>
        <button
          type="button"
          className={styles.main}
          onClick={() => setZoomOpen(true)}
          aria-label={t('enlarge', { name: product.name })}
        >
          <Image
            key={currentSrc}
            className={styles.mainImg}
            src={currentSrc}
            alt={product.name}
            fill
            sizes="(min-width: 1180px) 620px, (min-width: 860px) 52vw, calc(100vw - 32px)"
            loading={image === 0 ? 'eager' : 'lazy'}
            fetchPriority={image === 0 ? 'high' : 'auto'}
          />
          <span className={styles.zoomBadge} aria-hidden="true">
            <ShopIcon name="zoom" />
          </span>
        </button>

        {images.length > 1 && (
          <ul className={styles.thumbs} aria-label={t('galleryLabel', { name: product.name })}>
            {images.map((src, index) => (
              <li key={`${index}-${src}`}>
                <button
                  type="button"
                  className={styles.thumb}
                  onClick={() => selectImage(index)}
                  aria-pressed={image === index}
                  aria-label={t('showImage', { n: index + 1, total: images.length })}
                >
                  <Image src={src} alt="" fill sizes="72px" className={styles.thumbImg} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.info}>
        {header}

        {kind && (
          <fieldset className={styles.variants}>
            <legend className={styles.label}>{kind === 'colour' ? t('colour') : t('design')}</legend>
            <div className={styles.chips}>
              {product.color.map((value, index) => (
                <label key={`${index}-${value}`} className={styles.chip} title={kind === 'colour' ? value : undefined}>
                  <input
                    ref={index === 0 ? firstChip : undefined}
                    type="radio"
                    name={`variant-${product._id}`}
                    value={index}
                    checked={variant === index}
                    onChange={() => chooseVariant(index)}
                    className={styles.radio}
                  />
                  {kind === 'colour' ? (
                    <span className={styles.swatch} style={{ backgroundColor: value }} aria-hidden="true" />
                  ) : (
                    <span className={styles.design} aria-hidden="true">
                      {value}
                    </span>
                  )}
                  <span className="visually-hidden">{variantLabel(value, index)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className={styles.buy}>
          <div className={styles.qty}>
            <span className={styles.label} aria-hidden="true">
              {tCart('quantity')}
            </span>
            <QuantityStepper
              value={qty}
              label={t('quantityOf', { name: product.name })}
              onDecrease={() => setQuantity(Math.max(1, qty - 1))}
              onIncrease={() => setQuantity(Math.min(Math.max(1, addable), qty + 1))}
              decreaseDisabled={qty <= 1}
              increaseDisabled={qty >= addable}
            />
          </div>
          <button
            type="button"
            className={`ui-btn ui-btn--gold ${styles.add}`}
            data-added={justAdded}
            onClick={addToCart}
            disabled={!available}
            aria-disabled={available && addable === 0}
          >
            <ShopIcon name={justAdded ? 'check' : 'cart'} className={styles.addIcon} />
            <span>{!available ? t('outOfStock') : justAdded ? t('added') : tProduct('button.addToCart')}</span>
          </button>
        </div>

        <div className={styles.feedback} role="status" aria-live="polite">
          {available && addable === 0 && <p className={styles.note}>{t('maxInCart', { max: MAX_LINE_QUANTITY })}</p>}
          {message === 'added' && (
            <p className={`${styles.msg} ${styles.ok}`}>
              <ShopIcon name="check" />
              <span>{tProduct('message.productAdded')}</span>
              <Link href="/cart" className={styles.msgLink}>
                {t('viewCart')}
              </Link>
            </p>
          )}
          {message === 'chooseVariant' && (
            <p className={`${styles.msg} ${styles.warn}`}>
              <ShopIcon name="alert" />
              <span>{kind === 'colour' ? tProduct('message.error.selectColor') : t('selectDesign')}</span>
            </p>
          )}
        </div>

        {footer}
      </div>

      <ImageZoom
        open={zoomOpen}
        src={currentSrc}
        alt={product.name}
        closeLabel={t('close')}
        hint={t('zoomHint')}
        keysHint={t('zoomKeys')}
        onClose={() => setZoomOpen(false)}
      />
    </div>
  );
}
