import buildImages from './buildImages';

// Nazareth's Old City (route /oldcity).
const oldCity = {
  id: 'oldcity',
  path: '/oldcity',
  nameKey: 'home.siteOld',
  titleKey: 'headerTitleOld',
  hero: '/images/old/old9.jpg',
  cover: '/images/old/old2.jpg',
  mapUrl:
    'https://www.google.com/maps/place/The+Old+City,+Nazareth/@32.7035145,35.296555,14z/data=!3m1!4b1!4m6!3m5!1s0x151c4c2c9a805123:0x994648ecbf8111f3!8m2!3d32.703515!4d35.296555!16s%2Fg%2F1v5wddhc?entry=ttu',
  images: buildImages('old', 16, { 5: 'webp' }),
  story: [
    { text: 'mapDescriptionOld' },
    { text: 'churchDescriptionOld' },
    { text: 'waterSourceOld' },
  ],
};

export default oldCity;
