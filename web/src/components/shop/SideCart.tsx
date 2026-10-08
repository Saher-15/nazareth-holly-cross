'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { MAX_LINE_QUANTITY, useCart } from '@/lib/cart';
import { formatUsd } from '@/lib/pricing';
import { isCssColour } from './catalog';
import QuantityStepper from './QuantityStepper';
import ShopIcon from './ShopIcon';
import styles from './SideCart.module.css';

// The cart on every page (except the cart and the checkout themselves): a tab on the side of the screen with the
// number of items and the total, which opens the cart in a side panel (a native modal <dialog>: focus stays inside,
// Escape closes it, focus returns to the tab). Same lines, quantities and totals as the cart page (lib/cart.tsx).
const HIDDEN_ON = ['/cart', '/checkout'];

export default function SideCart() {
  const t = useTranslations('shopPage');
  const tCart = useTranslations('cart');
  const locale = useLocale();
  const pathname = usePathname();
  const { lines, ready, count, summary, dispatch } = useCart();
  // The page the panel was opened on: moving to another page (a link inside the panel) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const money = (amount: number) => formatUsd(amount, locale);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const hidden = !ready || count === 0 || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (hidden && !open) return null;

  const close = () => ref.current?.close();
  const variantText = (value: string) => (isCssColour(value) ? `${t('colour')}: ${value}` : t('designName', { name: value }));

  return (
    <>
      {!hidden && (
        <button type="button" className={styles.tab} onClick={() => setOpenOn(pathname)} aria-label={t('cartAria', { count })} aria-haspopup="dialog" data-testid="side-cart-tab">
          <ShopIcon name="cart" className={styles.tabIcon} />
          <span key={count} className={styles.count} aria-hidden="true">{count}</span>
          <span className={styles.tabTotal} aria-hidden="true">{money(summary.total)}</span>
        </button>
      )}
      <dialog
        ref={ref}
        className={styles.drawer}
        aria-labelledby={titleId}
        onClose={() => setOpenOn(null)}
        onClick={(e) => e.target === e.currentTarget && close()}
        data-testid="side-cart"
      >
        <div className={styles.panel}>
          <div className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              <ShopIcon name="cart" className={styles.titleIcon} />
              {t('cartLink')}
            </h2>
            <button type="button" className={styles.close} onClick={close} aria-label={t('sideCartClose')}>
              <ShopIcon name="close" />
            </button>
          </div>
          {open && (
            <>
              {lines.length === 0 ? (
                <p className={styles.empty}>{tCart('emptyCart')}</p>
              ) : (
                <ul className={styles.lines}>
                  {lines.map((line) => (
                    <li key={`${line._id}-${line.color}`} className={styles.line} data-testid="side-cart-line">
                      <div className={styles.lineText}>
                        <Link href={`/shop/${line._id}`} className={styles.name}><bdi>{line.name}</bdi></Link>
                        {line.color && (
                          <span className={styles.variant}>
                            {isCssColour(line.color) && <span className={styles.swatch} style={{ backgroundColor: line.color }} aria-hidden="true" />}
                            {variantText(line.color)}
                          </span>
                        )}
                        <span className={styles.unit}>{t('unitPrice', { price: money(line.price) })}</span>
                      </div>
                      <div className={styles.lineControls}>
                        <QuantityStepper
                          value={line.quantity}
                          label={t('quantityOf', { name: line.name })}
                          onDecrease={() => dispatch({ type: 'setQuantity', _id: line._id, color: line.color, quantity: line.quantity - 1 })}
                          onIncrease={() => dispatch({ type: 'setQuantity', _id: line._id, color: line.color, quantity: line.quantity + 1 })}
                          decreaseDisabled={line.quantity <= 1}
                          increaseDisabled={line.quantity >= MAX_LINE_QUANTITY}
                        />
                        <span className={styles.lineTotal}>{money(line.price * line.quantity)}</span>
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => dispatch({ type: 'remove', _id: line._id, color: line.color })}
                          aria-label={t('removeItem', { name: line.name })}
                        >
                          <ShopIcon name="trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.foot}>
                <dl className={styles.sums}>
                  <div><dt>{t('subtotal')}</dt><dd>{money(summary.subtotal)}</dd></div>
                  {summary.discount > 0 && <div><dt>{t('discount')}</dt><dd>{money(-summary.discount)}</dd></div>}
                  <div><dt>{t('shipping')}</dt><dd>{money(summary.shipping)}</dd></div>
                  <div className={styles.grand}><dt>{t('total')}</dt><dd data-testid="side-cart-total">{money(summary.total)}</dd></div>
                </dl>
                {lines.length > 0 && (
                  <Link href="/checkout" className={`ui-btn ui-btn--gold ${styles.checkout}`}>{tCart('checkout')}</Link>
                )}
                <Link href="/cart" className={`ui-btn ui-btn--ghost ${styles.viewCart}`}>{t('sideCartView')}</Link>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
