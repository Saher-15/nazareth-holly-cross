// Sunrise and sunset, computed in the page itself: no weather service, no request to anyone.
//
// The NOAA solar calculator's equations (from Jean Meeus, "Astronomical Algorithms"): the sun's declination and the
// equation of time for the day, then the hour angle at which the sun's upper edge touches a flat horizon, with the
// usual 0.833° for refraction and the sun's radius. Accurate to about a minute between latitudes 60° N and 60° S,
// which is what a "sunrise 06:27" line needs. The height of the place (Nazareth sits at about 350 m) and the hills
// around it are ignored, as every almanac does.

/** The city centre of Nazareth (the Basilica of the Annunciation, `web/src/data/places/places.ts`). */
export const NAZARETH_COORDS = { lat: 32.70222, lng: 35.2975 } as const;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The sun's declination (degrees) and the equation of time (minutes) at a Julian day. */
function solarPosition(julianDay: number): { declination: number; equationOfTime: number } {
  const t = (julianDay - 2451545) / 36525; // Julian centuries since J2000.0
  const meanLong = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const m = rad(meanAnomaly);
  const centre =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLong = meanLong + centre - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega));
  const declination = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLong))));
  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const l0 = rad(meanLong);
  const equationOfTime =
    4 *
    deg(
      y * Math.sin(2 * l0) -
        2 * eccentricity * Math.sin(m) +
        4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
        0.5 * y * y * Math.sin(4 * l0) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * m),
    );
  return { declination, equationOfTime };
}

export type SunTimes = {
  /** Sunrise and sunset as moments in time; null on a day when the sun does not rise or does not set (polar). */
  sunrise: Date | null;
  sunset: Date | null;
};

/**
 * Sunrise and sunset of a calendar day at a place.
 * @param isoDate the local calendar day, "YYYY-MM-DD" (in Nazareth: `nazarethDate()` of the verse of the day)
 * @param place latitude (north positive) and longitude (east positive), in degrees
 */
export function sunTimes(isoDate: string, place: { lat: number; lng: number } = NAZARETH_COORDS): SunTimes {
  const [year, month, day] = isoDate.split('-').map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  const julianMidnight = midnightUtc / 86_400_000 + 2440587.5;

  // Each event is computed at its own approximate time of day, then once more at the corrected time.
  const event = (sign: -1 | 1): Date | null => {
    let minutes = 720 - 4 * place.lng; // first guess: solar noon, in minutes after midnight UTC
    for (let pass = 0; pass < 2; pass++) {
      const { declination, equationOfTime } = solarPosition(julianMidnight + minutes / 1440);
      const cosHourAngle =
        Math.cos(rad(90.833)) / (Math.cos(rad(place.lat)) * Math.cos(rad(declination))) -
        Math.tan(rad(place.lat)) * Math.tan(rad(declination));
      if (cosHourAngle > 1 || cosHourAngle < -1) return null;
      const hourAngle = deg(Math.acos(cosHourAngle));
      minutes = 720 - 4 * (place.lng + sign * hourAngle) - equationOfTime;
    }
    return new Date(midnightUtc + Math.round(minutes * 60) * 1000);
  };

  return { sunrise: event(1), sunset: event(-1) };
}
