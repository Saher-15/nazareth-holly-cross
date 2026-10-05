import React from 'react';
import PlacePage from './places/PlacePage';
import city from './places/data/city';

// The City of Nazareth: content, photos and map link live in places/data/city.js.
const Nazareth = () => <PlacePage place={city} />;

export default Nazareth;
