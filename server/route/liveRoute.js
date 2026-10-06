import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { liveStatus } from '../services/live.js';
import { publicRecordings } from '../services/liveRecordings.js';
import { publicSchedule } from '../services/liveSchedule.js';

// The public side of live broadcasting (docs/LIVE.md):
//
//   GET /live/status      ->  { live: false }  or  { live: true, id, title, startedAt, playbackUrl }
//   GET /live/recordings  ->  { items: [{ id, title, date, durationSeconds, thumbnailUrl, playbackUrl }] }
//   GET /live/schedule    ->  { timeZone, items: [{ id, title, description, startsAt, status }] }
//
// The website polls the status (every page: the header's dot and the "we are live" window; faster on /live). The
// answer comes from memory for 5 seconds (services/live.js), carries a 5-second Cache-Control (utils/security.js), and
// has a rate limit of its own. The recordings (published and ready) and the schedule (published, upcoming) are
// answered from memory for a minute and half a minute, with the public-read limit and Cache-Control.
//
// The old "room" routes (POST /live/create_room, GET /live/room_id, POST /live/close_room: one id kept in the memory of
// the process, readable by anyone) were removed: no page of web/ or admin/ used them (docs/LIVE.md section 8).

const routerLive = express.Router();

routerLive.get('/status', asyncHandler(async (req, res) => {
  res.json(await liveStatus());
}));

routerLive.get('/recordings', asyncHandler(async (req, res) => {
  res.json(await publicRecordings());
}));

routerLive.get('/schedule', asyncHandler(async (req, res) => {
  res.json(await publicSchedule());
}));

export default routerLive;
