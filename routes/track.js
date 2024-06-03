import express from 'express';
import Miscellaneous from '../utils/misc.js';
import ProjectConfigs from '../utils/data/configs.js';
import LinksQueue from '../utils/data/ops/links_queue.js';
import EmailsQueue from '../utils/data/ops/emails_queue.js';

const router = express.Router();
const linksQueue = new LinksQueue();
const statsQueue = new EmailsQueue();

// track email opens.
router.get('/track/pixel.png', async (req, res) => {
    if (req.query && req.query.uuid) statsQueue.add(req.query.uuid);

    const pixel = Miscellaneous.trackingPixel();

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
    });

    res.end(pixel);
});

// track link clicks.
router.get('/track/link', async (req, res) => {
    if (req.query && req.query.postId && req.query.redirect) {
        linksQueue.add(req.query.postId, req.query.redirect);
        res.redirect(req.query.redirect);
    } else {
        // redirect to main ghost blog.
        ProjectConfigs.ghost().then((cfg) => res.redirect(cfg.url));
    }
});

export default router;
