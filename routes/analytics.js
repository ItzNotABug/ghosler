import express from 'express';
import Files from '../utils/data/files.js';

const router = express.Router();

router.get('/', async (req, res) => {
    res.render('analytics', await Files.all());
});

router.post('/delete/:postId', async (req, res) => {
    const postId = req.params.postId;
    const result = await Files.delete(postId);
    res.send(result);
});

export default router;