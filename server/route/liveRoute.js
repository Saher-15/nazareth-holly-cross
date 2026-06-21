import express from "express"

const routerLive = express.Router();

let live_room_id = "";

routerLive.post('/create_room', async (req, res) => {
    try {
        const { roomID } = req.body;
        live_room_id = roomID;
        res.status(200).send('Room ID broadcasted to clients.');
    } catch (error) {
        res.status(500).write(`data: ${JSON.stringify({ error: 'Failed to stream data' })}\n\n`);
    }
})

routerLive.get('/room_id', async (req, res) => {
    try {
        res.status(200).json({roomID: live_room_id});
    } catch (error) {
        res.status(500).write(`data: ${JSON.stringify({ error: 'Failed to stream data' })}\n\n`);
    }
})

routerLive.post('/close_room', async (req, res) => {
    try {
        live_room_id = "";
        res.status(200).send('Live Stream closed');
    } catch (error) {
        res.status(500).write(`data: ${JSON.stringify({ error: 'Failed to stream data' })}\n\n`);
    }
})

export default routerLive