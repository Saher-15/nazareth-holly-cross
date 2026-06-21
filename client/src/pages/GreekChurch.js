import React from 'react';
import { useTranslation } from 'react-i18next';
import GalleryPageLayout from '../components/GalleryPageLayout';

const images = Array.from({ length: 18 }, (_, i) => `images/greek/greek${i + 1}.jpg`);

const GreekChurch = () => {
  const { t } = useTranslation();

  const contentSections = [
    { text: t('contentGreek.paragraph1') },
    { text: t('contentGreek.paragraph2') },
    { text: t('contentGreek.paragraph3') },
  ];

  return (
    <GalleryPageLayout
      title={t('headerGreek.title')}
      mapsUrl="https://www.google.com/maps/place/The+Greek+Orthodox+Church+of+the+Annunciation/@32.7070723,35.3016619,17z"
      images={images}
      contentSections={contentSections}
    />
  );
};

export default GreekChurch;
