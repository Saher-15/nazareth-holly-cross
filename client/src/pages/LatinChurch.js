import React from 'react';
import { useTranslation } from 'react-i18next';
import GalleryPageLayout from '../components/GalleryPageLayout';

const images = Array.from({ length: 27 }, (_, i) => `images/latin/latin${i + 1}.jpg`);

const LatinChurch = () => {
  const { t } = useTranslation();

  const contentSections = [
    { text: t('contentLatin.paragraph1') },
    { title: t('contentLatin.history.title'), text: t('contentLatin.history.text') },
    { title: t('contentLatin.architecture.title'), text: t('contentLatin.architecture.text') },
    { title: t('contentLatin.visiting.title'), text: t('contentLatin.visiting.text') },
  ];

  return (
    <GalleryPageLayout
      title={t('headerLatin.title')}
      mapsUrl="https://www.google.com/maps/place/Nazareth+City+center/@32.7021997,35.2974033,17z"
      images={images}
      contentSections={contentSections}
    />
  );
};

export default LatinChurch;
