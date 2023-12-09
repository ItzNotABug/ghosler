import express from 'express';
import Newsletter from '../utils/newsletter.js';

const router = express.Router();

router.get('/', async (_, res) => {
    res.render('newsletter', await Newsletter.preview());
});

export default router;