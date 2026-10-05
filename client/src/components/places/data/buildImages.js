// Public photo paths of one place: /images/<folder>/<folder><n>.<ext> for n = 1..count.
// `ext` lists the photo numbers that are not .jpg, e.g. { 5: 'webp' }.
export default function buildImages(folder, count, ext = {}) {
  return Array.from(
    { length: count },
    (_, i) => `/images/${folder}/${folder}${i + 1}.${ext[i + 1] || 'jpg'}`
  );
}
