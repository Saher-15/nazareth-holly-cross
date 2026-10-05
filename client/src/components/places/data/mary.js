import buildImages from './buildImages';

// Mary's Well (route /maryswell).
const mary = {
  id: 'mary',
  path: '/maryswell',
  nameKey: 'home.siteMary',
  titleKey: 'headerMary.title',
  hero: '/images/mary/mary5.jpg',
  cover: '/images/mary/mary4.jpg',
  mapUrl:
    'https://www.google.com/maps/place/Mary%E2%80%99s+Well/@32.7035145,35.296555,14z/data=!4m6!3m5!1s0x151c4c29c6d1008d:0x23e218b489e18311!8m2!3d32.7060586!4d35.3013417!16zL20vMGY3XzJ2?entry=ttu',
  images: buildImages('mary', 7),
  story: [
    { text: 'contentMary.intro' },
    {
      title: 'contentMary.significance.title',
      points: [
        ['contentMary.significance.biblical', 'contentMary.significance.biblicalText'],
        ['contentMary.significance.cultural', 'contentMary.significance.culturalText'],
        ['contentMary.significance.architecture', 'contentMary.significance.architectureText'],
      ],
    },
    {
      title: 'contentMary.modern.title',
      points: [
        ['contentMary.modern.restoration', 'contentMary.modern.restorationText'],
        ['contentMary.modern.attraction', 'contentMary.modern.attractionText'],
        ['contentMary.modern.surroundings', 'contentMary.modern.surroundingsText'],
      ],
    },
    {
      title: 'contentMary.visiting.title',
      points: [
        ['contentMary.visiting.location', 'contentMary.visiting.locationText'],
        ['contentMary.visiting.accessibility', 'contentMary.visiting.accessibilityText'],
        ['contentMary.visiting.culturalExperience', 'contentMary.visiting.culturalExperienceText'],
      ],
    },
  ],
};

export default mary;
