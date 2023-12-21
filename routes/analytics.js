import express from 'express';
import Ghost from '../utils/api/ghost.js';
import Files from '../utils/data/files.js';

const router = express.Router();

router.get('/', async (req, res) => {
    res.render('dashboard/analytics', await Files.all());
});

router.post('/delete/:postId', async (req, res) => {
    const postId = req.params.postId;
    const result = await Files.delete(postId);
    res.send(result);
});

router.get('/details/:postId', async (req, res) => {
    const postId = req.params.postId;
    const post = await Files.get(postId);
    const postSentiments = await new Ghost().postSentiments(postId);
    res.render('dashboard/details', {post, postSentiments});
});

export default router;