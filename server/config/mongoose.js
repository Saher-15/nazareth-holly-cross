import mongoose from 'mongoose';

// Query safety, applied once at startup (index.js).
//   sanitizeFilter: an operator object used as a query value ({ category: { "$ne": "x" } }) is turned
//                   into a plain equality match, so user input can never become a query operator. The few
//                   queries that need an operator of ours mark it with mongoose.trusted().
//   strictQuery:    filter fields the schema does not know are dropped instead of being sent to MongoDB.
// This backs up express-mongo-sanitize (app.js), which strips "$" keys from the request itself.
export function applyMongooseSafety() {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
}
