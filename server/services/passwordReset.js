import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Admin from '../model/admin.js';
import { config } from '../config/env.js';
import { hashPassword } from './adminAuth.js';
import { sendMail } from './emailService.js';

// Password reset for dashboard accounts, by e-mail.
//
//   requestReset(email)  -> if an enabled account has this e-mail (or this e-mail as its username), a one-time link
//                           valid for RESET_MINUTES is mailed to that address. A new request replaces the previous link.
//                           While NO account exists at all, an address in config.adminBootstrapEmails first gets an
//                           owner account with an unusable random password: the link is how the owner chooses one.
//   findByResetToken(t)  -> the account a still-valid link belongs to; the route sets the new password.
//
// Only SHA-256(token) is stored; the token itself exists only in the e-mail. Whatever happens, the route answers the
// browser the same way, so the form never says whether an address has an account.

export const RESET_MINUTES = 30;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
export const normaliseEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
export const looksLikeEmail = (value) => value.length >= 6 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isResetToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Escapes a plain value for the HTML part of the mail.
const html = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function createFirstOwner(email) {
  try {
    const owner = new Admin({
      username: email,
      email,
      role: 'owner',
      // Nobody knows this password: the reset link is the only way in.
      password: await hashPassword(crypto.randomBytes(32).toString('base64url')),
    });
    owner.$locals.passwordHashed = true;
    await owner.save();
    return { admin: owner, created: true };
  } catch (error) {
    // Two requests at once: the unique username index lets one win; the other uses the account it created.
    if (error?.code === 11000) return { admin: await Admin.findOne({ username: email }), created: false };
    throw error;
  }
}

/** Returns { admin, created, sent: Promise<boolean> } (admin is null when nothing was done). The route never tells the browser. */
export async function requestReset(rawEmail, { now = new Date() } = {}) {
  const email = normaliseEmail(rawEmail);
  if (!looksLikeEmail(email)) return { admin: null, created: false, sent: Promise.resolve(false) };

  // Addresses are compared without regard to case (an account may have been saved as Saher@Example.com). The pattern
  // is built from a validated address with every special character escaped, hence trusted.
  const exact = () => mongoose.trusted({ $regex: `^${escapeRegex(email)}$`, $options: 'i' });
  let admin = await Admin.findOne({ $or: [{ email: exact() }, { username: exact() }] });
  let created = false;
  if (!admin && config.adminBootstrapEmails.includes(email) && (await Admin.countDocuments({})) === 0) {
    ({ admin, created } = await createFirstOwner(email));
  }
  if (!admin || admin.disabled === true) return { admin: null, created, sent: Promise.resolve(false) };

  const token = crypto.randomBytes(32).toString('base64url'); // 43 characters
  const expires = new Date(now.getTime() + RESET_MINUTES * 60 * 1000);
  await Admin.updateOne({ _id: admin._id }, { $set: { resetTokenHash: sha256(token), resetTokenExpires: expires } });

  const link = `${config.adminAppUrl}/reset-password?token=${token}`;
  const to = normaliseEmail(admin.email) || email;
  const intro = created
    ? 'An owner account was created for this address on the Nazareth Holy Cross dashboard.'
    : 'Someone asked to reset the password of your Nazareth Holy Cross dashboard account.';
  // Not awaited: the caller answers the browser first, so neither a slow mail server nor the time it takes says whether
  // the address has an account. sendMail never throws; the promise says whether the mail went out.
  const sent = sendMail({
    to: [to],
    subject: created ? 'Nazareth Holy Cross dashboard: choose your password' : 'Nazareth Holy Cross dashboard: reset your password',
    text: [
      intro,
      '',
      `Choose a password here (the link works once, for ${RESET_MINUTES} minutes):`,
      link,
      '',
      `Your username: ${admin.username}`,
      '',
      'If you did not ask for this, ignore this e-mail: nothing changes.',
    ].join('\n'),
    html: `<p>${intro}</p>`
      + `<p><a href="${html(link)}">Choose a password</a> (the link works once, for ${RESET_MINUTES} minutes).</p>`
      + `<p>Your username: <b>${html(admin.username)}</b></p>`
      + '<p>If you did not ask for this, ignore this e-mail: nothing changes.</p>',
  });
  return { admin, created, sent };
}

/** The account a still-valid link belongs to, or null. Changes nothing. */
export async function findByResetToken(token, { now = new Date() } = {}) {
  if (!isResetToken(token)) return null;
  const admin = await Admin.findOne({ resetTokenHash: sha256(token) }).select('+resetTokenHash');
  if (!admin || !admin.resetTokenExpires || new Date(admin.resetTokenExpires).getTime() <= now.getTime()) return null;
  if (admin.disabled === true) return null;
  return admin;
}
