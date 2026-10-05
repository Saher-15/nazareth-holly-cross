import buildImages from './buildImages';

// The City of Nazareth (route /city).
const city = {
  id: 'city',
  path: '/city',
  nameKey: 'home.siteCity',
  titleKey: 'headerTitleNaz',
  hero: '/images/nazareth/nazareth1.webp',
  cover: '/images/nazareth/nazareth1.webp',
  mapUrl:
    'https://www.google.com/maps/place/Nazareth+City+center/@32.7012442,35.2981717,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4dd4b3386aef:0x652378b0cec4d358!8m2!3d32.7012442!4d35.2981717!16s%2Fg%2F11c5s6wx03?entry=ttu',
  images: buildImages('nazareth', 12, { 1: 'webp', 7: 'webp', 8: 'webp' }),
  story: [
    { text: 'contentNaz.introduction' },
    { title: 'contentNaz.historicalSignificance.title', text: 'contentNaz.historicalSignificance.text' },
    { title: 'contentNaz.modernNazareth.title', text: 'contentNaz.modernNazareth.text' },
    { title: 'contentNaz.accessibility.title', text: 'contentNaz.accessibility.text' },
  ],
};

export default city;
