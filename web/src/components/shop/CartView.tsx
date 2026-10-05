'use client';

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MAX_LINE_QUANTITY, useCart, type CartLine } from '@/lib/cart';
import { formatUsd } from '@/lib/pricing';
import QuantityStepper from './QuantityStepper';
import ShopIcon from './ShopIcon';
import { CartSkeleton } from './Skeletons';
import StateCard from './StateCard';
import { isCssColour } from './catalog';
import styles from './CartView.module.css';

// Only our own images (local files and the shop's Firebase storage) go through
// next/image; anything else that found its way into localStorage is not shown.
const isShopImage = (src: string) => /^(\/(?!\/)|https:\/\/firebasestorage\.googleapis\.com\/)/.test(src);

// The cart lives in the browser, so this whole view renders on the client.
// Prices are for display; the API computes what is charged (see lib/pricing.ts).
export default function CartView() {
  const t = useTranslations('shopPage');
  const tCart = useTranslations('cart');
  const locale = useLocale();
  const { lines, ready, count, summary, dispatch } = useCart();
  const [announcement, setAnnouncement] = useState('');
  const listHeading = useRef<HTMLHeadingElement>(null);
  const emptyHeading = useRef<HTMLHeadingElement>(null);

  const money = (amount: number) => formatUsd(amount, locale);

  // Removing a row would drop keyboard focus on <body>; move it to the list (or the
  // empty-cart message) and say what happened.
  const remove = (line: CartLine) => {
    const wasLast = lines.length === 1;
    flushSync(() => {
      dispatch({ type: 'remove', _id: line._id, color: line.color });
      setAnnouncement(t('removed', { name: line.name }));
    });
    (wasLast ? emptyHeading : listHeading).current?.focus();
  };

  const setQuantity = (line: CartLine, quantity: number) =>
    dispatch({ type: 'setQuantity', _id: line._id, color: line.color, quantity });

  const variantText = (value: string) =>
    isCssColour(value) ? `${t('colour')}: ${value}` : t('designName', { name: value });

  return (
    <div className={`ui-container ${styles.wrap}`}>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      {!ready ? (
        <CartSkeleton label={t('loading')} />
      ) : lines.length === 0 ? (
        <StateCard
          icon="basket"
          title={tCart('emptyCart')}
          text={t('emptyLead')}
          headingRef={emptyHeading}
        >
          <Link href="/shop" className="ui-btn ui-btn--gold">
            {tCart('backToShopping')}
          </Link>
        </StateCard>
      ) : (
        <>
          <p className={styles.lead} data-testid="cart-count-text">
            {t('cartCount', { count })}
          </p>
          <div className={styles.layout}>
            <section className={styles.items} aria-labelledby="cart-items-heading">
              <h2 id="cart-items-heading" ref={listHeading} tabIndex={-1} className="visually-hidden">
                {t('itemsHeading')}
              </h2>
              <ul className={styles.list}>
                {lines.map((line) => (
                  <li key={`${line._id}-${line.color}`} className={`ui-glass ${styles.item}`} data-testid="cart-line">
                    <Link
                      href={`/shop/${line._id}`}
                      className={styles.media}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      {isShopImage(line.img) && <Image src={line.img} alt="" fill sizes="112px" className={styles.img} />}
                    </Link>

                    <div className={styles.body}>
                      <h3 className={styles.name}>
                        <Link href={`/shop/${line._id}`}>
                          <bdi>{line.name}</bdi>
                        </Link>
                      </h3>
                      {line.color && (
                        <p className={styles.variant}>
                          {isCssColour(line.color) && (
                            <span className={styles.swatch} style={{ backgroundColor: line.color }} aria-hidden="true" />
                          )}
                          {variantText(line.color)}
                        </p>
                      )}
                      <p className={styles.unit}>{t('unitPrice', { price: money(line.price) })}</p>
                    </div>

                    <div className={styles.controls}>
                      <QuantityStepper
                        value={line.quantity}
                        label={t('quantityOf', { name: line.name })}
                        onDecrease={() => setQuantity(line, line.quantity - 1)}
                        onIncrease={() => setQuantity(line, line.quantity + 1)}
                        decreaseDisabled={line.quantity <= 1}
                        increaseDisabled={line.quantity >= MAX_LINE_QUANTITY}
                      />
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => remove(line)}
                        aria-label={t('removeItem', { name: line.name })}
                      >
                        <ShopIcon name="trash" className={styles.removeIcon} />
                        <span className={styles.removeText}>{tCart('remove')}</span>
                      </button>
                    </div>

                    <p className={styles.total} data-testid="line-total">
                      {money(line.price * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <aside className={`ui-glass ${styles.summary}`} aria-labelledby="cart-summary-title">
              <h2 id="cart-summary-title" className={styles.summaryTitle}>
                {t('summaryTitle')}
              </h2>
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt>{t('subtotal')}</dt>
                  <dd data-testid="cart-subtotal">{money(summary.subtotal)}</dd>
                </div>
                <div className={`${styles.row} ${styles.discount}`}>
                  <dt>{t('discount')}</dt>
                  <dd data-testid="cart-discount">{money(-summary.discount)}</dd>
                </div>
                <div className={styles.row}>
                  <dt>{t('shipping')}</dt>
                  <dd data-testid="cart-shipping">{money(summary.shipping)}</dd>
                </div>
                <div className={`${styles.row} ${styles.grand}`}>
                  <dt>{t('total')}</dt>
                  <dd data-testid="cart-total">{money(summary.total)}</dd>
                </div>
              </dl>

              <Link href="/checkout" className={`ui-btn ui-btn--gold ${styles.checkout}`}>
                <ShopIcon name="lock" />
                {tCart('checkout')}
              </Link>
              <Link href="/shop" className={`ui-btn ui-btn--ghost ${styles.continue}`}>
                {tCart('continueShopping')}
              </Link>
              <p className={styles.secure}>
                <ShopIcon name="lock" className={styles.secureIcon} />
                {t('secure')}
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
