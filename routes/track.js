import express from 'express';
import Post from '../utils/models/post.js';
import Miscellaneous from '../utils/misc.js';

const router = express.Router();

router.get('/', async (req, res) => {
    if (req.query && req.query.uuid) {
        Post.updateStats(req.query.uuid).then();
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