import buildImages from './buildImages';

// Basilica of the Annunciation (route /latin).
const latin = {
  id: 'latin',
  path: '/latin',
  nameKey: 'home.siteLatin',
  titleKey: 'headerLatin.title',
  hero: '/images/latin/latin1.jpg',
  cover: '/images/latin/latin1.jpg',
  mapUrl:
    'https://www.google.com/maps/place/Nazareth+City+center/@32.7021997,35.2974033,17z/data=!4m6!3m5!1s0x151c4dd4b3386aef:0x652378b0cec4d358!8m2!3d32.7012442!4d35.2981717!16s%2Fg%2F11c5s6wx03?entry=ttu',
  images: buildImages('latin', 27),
  story: [
    { text: 'contentLatin.paragraph1' },
    { title: 'contentLatin.history.title', text: 'contentLatin.history.text' },
    { title: 'contentLatin.architecture.title', text: 'contentLatin.architecture.text' },
    { title: 'contentLatin.visiting.title', text: 'contentLatin.visiting.text' },
  ],
};

export default latin;
