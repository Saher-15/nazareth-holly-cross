import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: config.mail.from,
    pass: config.mail.appPassword,
  },
  // nodemailer waits two minutes by default; the candle route answers only after the mail is sent
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

export const SENDER = { name: 'Nazareth Holy Cross', address: config.mail.from };

// Sends one message. Never throws: returns true on success, false (and logs) on failure.
export async function sendMail(message) {
  try {
    await transporter.sendMail({ from: SENDER, ...message });
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Email send failed: ${err.message}`);
    return false;
  }
}
