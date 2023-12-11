import express from 'express';
import Queue from '../utils/data/queue.js';
import Miscellaneous from '../utils/misc.js';

const statsQueue = new Queue();
const router = express.Router();

router.get('/', async (req, res) => {
    if (req.query && req.query.uuid) {
        statsQueue.add(req.query.uuid).then();
    }

    const pixel = Miscellaneous.trackingPixel();

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    res.end(pixel);
});

export default router;