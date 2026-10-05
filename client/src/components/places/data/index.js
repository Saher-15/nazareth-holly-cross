import latin from './latin';
import greek from './greek';
import mary from './mary';
import oldCity from './oldCity';
import city from './city';

// The holy places, in the order they are shown in the place cards.
const PLACES = [latin, greek, mary, oldCity, city];

// The virtual tour, shown as one more card next to the places.
export const TOUR = {
  id: 'tour',
  path: '/tour',
  nameKey: 'home.siteTour',
  cover: '/images/old/old11.jpg',
};

export default PLACES;
