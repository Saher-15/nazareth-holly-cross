// The API's e-mail check (server/utils/validate.js isEmail), so a form refuses exactly what the API would refuse and
// says so in the person's language instead of showing the API's English "Invalid email".
// It is applied to the text as the API sees it: the API's sanitiser turns "&" into "&amp;" first (lib/entities.ts).

const API_EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isApiEmail(value: string): boolean {
  const v = value.trim().replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return v.length <= 254 && API_EMAIL.test(v);
}
