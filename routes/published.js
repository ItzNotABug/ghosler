import express from 'express';
import Post from '../utils/models/post.js';
import Newsletter from '../utils/newsletter.js';
import {logDebug, logTags} from '../utils/log/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
    if (!req.body || !req.body.post || !req.body.post.current) {
        res.json({message: "Post content seems to be missing!"});
    }

    const post = Post.make(req.body);
    const created = await post.save();
    logDebug(logTags.Newsletter, 'Post received via webhook.');

    if (!created) {
        res.json({message: "Unable to save the post data!"});
    } else {
        Newsletter.send(post).then(); // schedule sending.
        res.json({message: "Newsletter will be sent shortly"});
    }
});

export default router;