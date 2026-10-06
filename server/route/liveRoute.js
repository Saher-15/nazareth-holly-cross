import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { liveStatus } from '../services/live.js';

// The public side of live broadcasting (docs/LIVE.md):
//
//   GET /live/status  ->  { live: false }  or  { live: true, title, startedAt, playbackUrl }
//
// The website's /live page polls it (about every 15 seconds while it is open). The answer comes from memory for 5
// seconds (services/live.js), carries a 5-second Cache-Control (utils/security.js), and has a rate limit of its own.
//
// The old "room" routes (POST /live/create_room, GET /live/room_id, POST /live/close_room: one id kept in the memory of
// the process, readable by anyone) were removed: no page of web/ or admin/ used them (docs/LIVE.md section 8).

const routerLive = express.Router();

routerLive.get('/status', asyncHandler(async (req, res) => {
  res.json(await liveStatus());
}));

export default routerLive;
