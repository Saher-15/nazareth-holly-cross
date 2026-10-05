import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import CartPill from '@/components/shop/CartPill';
import ShopIcon from '@/components/shop/ShopIcon';
import styles from '../shop.module.css';

// "Continue shopping" on one side, the cart on the other.
export default function TopBar() {
  const t = useTranslations('cart');
  return (
    <div className={`ui-container ${styles.top}`}>
      <Link href="/shop" className={styles.back}>
        <ShopIcon name="arrowBack" className={styles.backIcon} />
        <span>{t('continueShopping')}</span>
      </Link>
      <CartPill />
    </div>
  );
}
