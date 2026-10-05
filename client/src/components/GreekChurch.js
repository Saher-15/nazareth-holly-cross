import React from 'react';
import PlacePage from './places/PlacePage';
import greek from './places/data/greek';

// Greek Orthodox Church of the Annunciation: content, photos and map link live in places/data/greek.js.
const GreekChurch = () => <PlacePage place={greek} />;

export default GreekChurch;
