import React from 'react';
import { useTranslation } from 'react-i18next';
import './shopUi.css';
import './loading.css';

// Skeleton placeholders (replace the old spinner). Shapes mirror the real
// product card and product page so the layout does not jump when data lands.

export const ProductCardSkeleton = () => (
  <li className="shp-skel-card ui-glass" aria-hidden="true">
    <span className="shp-skel-card__img ui-skeleton" />
    <span className="shp-skel-card__line ui-skeleton" />
    <span className="shp-skel-card__line shp-skel-card__line--short ui-skeleton" />
  </li>
);

export const ProductGridSkeleton = ({ count = 8 }) => {
  const { t } = useTranslation();
  return (
    <div className="shp-skel" role="status" aria-live="polite">
      <span className="shp-sr">{t('shopUi.loading')}</span>
      <ul className="shp-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
};

export const ProductPageSkeleton = () => {
  const { t } = useTranslation();
  return (
    <div className="shp-skel pdp-skel ui-container" role="status" aria-live="polite">
      <span className="shp-sr">{t('shopUi.loading')}</span>
      <div className="pdp-skel__media" aria-hidden="true">
        <span className="pdp-skel__main ui-skeleton" />
        <span className="pdp-skel__thumbs">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="pdp-skel__thumb ui-skeleton" />
          ))}
        </span>
      </div>
      <div className="pdp-skel__info" aria-hidden="true">
        <span className="pdp-skel__line pdp-skel__line--title ui-skeleton" />
        <span className="pdp-skel__line pdp-skel__line--price ui-skeleton" />
        <span className="pdp-skel__line ui-skeleton" />
        <span className="pdp-skel__line ui-skeleton" />
        <span className="pdp-skel__line pdp-skel__line--short ui-skeleton" />
        <span className="pdp-skel__line pdp-skel__line--btn ui-skeleton" />
      </div>
    </div>
  );
};

export default ProductGridSkeleton;
