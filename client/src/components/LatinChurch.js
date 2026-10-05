import React from 'react';
import PlacePage from './places/PlacePage';
import latin from './places/data/latin';

// Basilica of the Annunciation (Latin Church): content, photos and map link live in places/data/latin.js.
const LatinChurch = () => <PlacePage place={latin} />;

export default LatinChurch;
