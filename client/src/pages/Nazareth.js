import React from 'react';
import { useTranslation } from 'react-i18next';
import GalleryPageLayout from '../components/GalleryPageLayout';

const images = [
  'images/nazareth/nazareth1.webp', 'images/nazareth/nazareth2.jpg',
  'images/nazareth/nazareth3.jpg', 'images/nazareth/nazareth4.jpg',
  'images/nazareth/nazareth5.jpg', 'images/nazareth/nazareth6.jpg',
  'images/nazareth/nazareth7.webp', 'images/nazareth/nazareth8.webp',
  'images/nazareth/nazareth9.jpg', 'images/nazareth/nazareth10.jpg',
  'images/nazareth/nazareth11.jpg', 'images/nazareth/nazareth12.jpg',
];

const Nazareth = () => {
  const { t } = useTranslation();

  const contentSections = [
    { text: t('contentNaz.introduction') },
    { title: t('contentNaz.historicalSignificance.title'), text: t('contentNaz.historicalSignificance.text') },
    { title: t('contentNaz.modernNazareth.title'), text: t('contentNaz.modernNazareth.text') },
    { title: t('contentNaz.accessibility.title'), text: t('contentNaz.accessibility.text') },
  ];

  return (
    <GalleryPageLayout
      title={t('headerTitleNaz')}
      mapsUrl="https://www.google.com/maps/place/Nazareth+City+center/@32.7012442,35.2981717,17z"
      images={images}
      contentSections={contentSections}
    />
  );
};

export default Nazareth;
