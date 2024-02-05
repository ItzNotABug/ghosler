import express from 'express';
import Ghost from '../utils/api/ghost.js';
import Post from '../utils/models/post.js';
import Files from '../utils/data/files.js';
import Newsletter from '../utils/newsletter.js';

const router = express.Router();

router.get('/', (req, res) => res.redirect('/'));

router.get('/:postId', async (req, res) => {
    const postId = req.params.postId;

    if (!postId) {
        return res.render('dashboard/newsletters', {
            level: 'error',
            message: 'Post Id missing!'
        });
    }

    const postObject = await Files.get(postId);
    if (!postObject) {
        return res.render('dashboard/newsletters', {
            level: 'error',
            message: 'Invalid Post Id!'
        });
    }

    if (postObject && postObject.stats && postObject.stats.newsletterStatus === 'Unsent') {
        const newsletters = await new Ghost().newsletters();
        delete newsletters.meta; // we don't need meta here.

        res.render('dashboard/newsletters', {
            post: postObject,
            newsletters: newsletters
        });
    } else {
        res.render('dashboard/newsletters', {
            level: 'error',
            message: 'This post is already sent as a newsletter via email.'
        });
    }
});

router.post('/send', async (req, res) => {
    const formData = req.body;
    const postId = formData.postId;
    const newsletterId = formData.newsletterId;
    const newsletterName = formData.newsletterName;

    if (!postId || !newsletterId || !newsletterName) {
        return res.render('dashboard/newsletters', {
            level: 'error',
            message: 'Post Id, Newsletter Id or Newsletter Name is missing!'
        });
    }

    const postObject = await Files.get(postId);
    if (!postObject) {
        return res.render('dashboard/newsletters', {
            level: 'error',
            message: 'Invalid Post Id!'
        });
    }

    const post = Post.fromRaw(postObject);

    if (post && post.stats && post.stats.newsletterStatus === 'Unsent') {
        /**
         * Mark the post's current status as 'Sending'
         * This is done to prevent re-sending until Ghosler fetches members.
         */
        post.stats.newsletterStatus = 'Sending';
        post.stats.newsletterName = newsletterName;
        await post.update(true);

        // send the newsletter as usual.
        Newsletter.send(post, {id: newsletterId, name: newsletterName}).then();

        res.render('dashboard/newsletters', {
            post: post,
            level: 'success',
            message: 'Newsletter will be sent shortly.'
        });

    } else {
        res.render('dashboard/newsletters', {
            level: 'error',
            message: 'This post is already sent as a newsletter via email.'
        });
    }
});

export default router;