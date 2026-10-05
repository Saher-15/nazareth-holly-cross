import React from 'react';
import PlacePage from './places/PlacePage';
import mary from './places/data/mary';

// Mary's Well: content, photos and map link live in places/data/mary.js.
const Marys = () => <PlacePage place={mary} />;

export default Marys;
