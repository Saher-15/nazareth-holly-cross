import mongoose from 'mongoose';

// Whether Mongoose builds the indexes the models declare every time the server starts.
//
//   development / test   yes (a throw-away database should just work)
//   production           YES by default (the owner chose this on 06/10): the production database is tiny
//                        (about 84 KB in 2026), so a build takes a moment, and the payment ledger's unique index on paypalOrderId
//                        is what makes a duplicate registration impossible, so a deploy must not depend on someone
//                        running a script first. AUTO_INDEX=false turns it off (for a large database, where indexes are
//                        created on purpose with `node scripts/ensure-indexes.js --apply`, docs/DATABASE.md: it shows
//                        what it would do first and never drops anything unless told to).
//
// This runs before any model is compiled (index.js imports it first): Mongoose reads the option when a model is
// created.
export const autoIndexEnabled = (env = process.env) => env.AUTO_INDEX !== 'false';

export function applyIndexPolicy(env = process.env) {
  const enabled = autoIndexEnabled(env);
  mongoose.set('autoIndex', enabled);
  return enabled;
}

applyIndexPolicy();
