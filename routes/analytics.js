import express from 'express';
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

router.get('/links/:postId', async (req, res) => {
    const postId = req.params.postId;
    const post = await Files.get(postId);
    res.render('dashboard/links', post);
});

export default router;