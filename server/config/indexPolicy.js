import mongoose from 'mongoose';

// Whether Mongoose builds the indexes the models declare every time the server starts.
//
//   development / test   yes (a throw-away database should just work)
//   production           NO. Index builds on a live database are a deliberate act: they can be slow on a big
//                        collection, and a changed definition fails to start and conflicts with the old one.
//                        Indexes are created by `node scripts/ensure-indexes.js --apply` (docs/DATABASE.md), which
//                        shows what it would do first and never drops anything unless told to.
//                        AUTO_INDEX=true brings the old behaviour back (an emergency switch, not a recommendation).
//
// This runs before any model is compiled (index.js imports it first): Mongoose reads the option when a model is
// created.
export const autoIndexEnabled = (env = process.env) => env.AUTO_INDEX === 'true' || env.NODE_ENV !== 'production';

export function applyIndexPolicy(env = process.env) {
  const enabled = autoIndexEnabled(env);
  mongoose.set('autoIndex', enabled);
  return enabled;
}

applyIndexPolicy();
