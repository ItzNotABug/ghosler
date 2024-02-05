import express from 'express';
import Ghost from '../utils/api/ghost.js';
import Post from '../utils/models/post.js';
import Miscellaneous from '../utils/misc.js';
import Newsletter from '../utils/newsletter.js';
import {logDebug, logTags} from '../utils/log/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
    if (!req.body || !req.body.post || !req.body.post.current) {
        return res.status(400).json({message: 'Post content seems to be missing!'});
    }

    // check if the request is authenticated.
    const isSecure = await Miscellaneous.isPostSecure(req);
    if (!isSecure) {
        return res.status(401).json({message: 'Invalid Authorization.'});
    }

    // check if contains the ignore tag.
    if (Post.containsIgnoreTag(req.body)) {
        return res.status(200).json({message: 'Post contains `ghosler_ignore` tag, ignoring.'});
    }

    logDebug(logTags.Newsletter, 'Post received via webhook.');

    const post = Post.make(req.body);
    const newslettersCount = await new Ghost().newslettersCount();
    const created = await post.save(newslettersCount > 1);

    if (!created) {
        res.status(500).json({message: 'The post data could not be saved, or emails for this post have already been sent.'});
    } else {
        if (newslettersCount === 1) {
            Newsletter.send(post).then();
            res.status(200).json({message: 'Newsletter will be sent shortly.'});
        } else {
            // we probably have multiple active newsletters or none at all, so just save the post.
            res.status(200).json({message: 'Multiple or No active Newsletters found, current Post saved for manual action.'});
        }
    }
});

export default router;