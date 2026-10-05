import buildImages from './buildImages';

// Greek Orthodox Church of the Annunciation (route /greek).
const greek = {
  id: 'greek',
  path: '/greek',
  nameKey: 'home.siteGreek',
  titleKey: 'headerGreek.title',
  hero: '/images/greek/greek9.jpg',
  cover: '/images/greek/greek1.jpg',
  mapUrl:
    'https://www.google.com/maps/place/The+Greek+Orthodox+Church+of+the+Annunciation/@32.7070723,35.3016619,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4c29d17b5477:0xc7296709e9a3ab85!8m2!3d32.7070723!4d35.3016619!16s%2Fm%2F03gtxsl?entry=ttu',
  images: buildImages('greek', 18),
  story: [
    { text: 'contentGreek.paragraph1' },
    { text: 'contentGreek.paragraph2' },
    { text: 'contentGreek.paragraph3' },
  ],
};

export default greek;
