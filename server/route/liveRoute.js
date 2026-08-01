import express from 'express';
import { requireAdmin } from '../middleware/auth.js';

const routerLive = express.Router();
let live_room_id = '';

routerLive.post('/create_room', requireAdmin, (req, res) => {
  try {
    const { roomID } = req.body;
    if (!roomID) return res.status(400).json({ error: 'roomID is required' });
    live_room_id = roomID;
    res.json({ success: true, roomID: live_room_id });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

routerLive.get('/room_id', (req, res) => {
  try {
    res.json({ roomID: live_room_id });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

routerLive.post('/close_room', requireAdmin, (req, res) => {
  try {
    live_room_id = '';
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default routerLive;
