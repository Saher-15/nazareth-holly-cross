import React from 'react';
import PlacePage from './places/PlacePage';
import oldCity from './places/data/oldCity';

// Nazareth's Old City: content, photos and map link live in places/data/oldCity.js.
const OldNazareth = () => <PlacePage place={oldCity} />;

export default OldNazareth;
