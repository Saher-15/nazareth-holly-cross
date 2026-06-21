import React from 'react';
import { useTranslation } from 'react-i18next';
import GalleryPageLayout from '../components/GalleryPageLayout';

const images = Array.from({ length: 7 }, (_, i) => `images/mary/mary${i + 1}.jpg`);

const MarysWell = () => {
  const { t } = useTranslation();

  const contentSections = [
    { text: t('contentMary.intro') },
    { title: t('contentMary.significance.title'), text: t('contentMary.significance.culturalText') },
    { title: t('contentMary.modern.title'), text: t('contentMary.modern.restorationText') },
    { title: t('contentMary.visiting.title'), text: t('contentMary.visiting.locationText') },
  ];

  return (
    <GalleryPageLayout
      title={t('headerMary.title')}
      mapsUrl="https://www.google.com/maps/place/Mary%E2%80%99s+Well/@32.7035145,35.296555,14z"
      images={images}
      contentSections={contentSections}
    />
  );
};

export default MarysWell;
