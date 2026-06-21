import React from 'react';
import { useTranslation } from 'react-i18next';
import GalleryPageLayout from '../components/GalleryPageLayout';

const images = [
  'images/old/old1.jpg', 'images/old/old2.jpg', 'images/old/old3.jpg',
  'images/old/old4.jpg', 'images/old/old5.webp', 'images/old/old6.jpg',
  'images/old/old7.jpg', 'images/old/old8.jpg', 'images/old/old9.jpg',
  'images/old/old10.jpg', 'images/old/old11.jpg', 'images/old/old12.jpg',
  'images/old/old13.jpg', 'images/old/old14.jpg', 'images/old/old15.jpg',
  'images/old/old16.jpg',
];

const OldNazareth = () => {
  const { t } = useTranslation();

  const contentSections = [
    { text: t('mapDescriptionOld') },
    { text: t('churchDescriptionOld') },
    { text: t('waterSourceOld') },
  ];

  return (
    <GalleryPageLayout
      title={t('headerTitleOld')}
      mapsUrl="https://www.google.com/maps/place/The+Old+City,+Nazareth/@32.7035145,35.296555,14z"
      images={images}
      contentSections={contentSections}
    />
  );
};

export default OldNazareth;
