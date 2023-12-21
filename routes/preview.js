import express from 'express';
import Newsletter from '../utils/newsletter.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const preview = await Newsletter.preview();
    const template = await Newsletter.renderTemplate(preview);
    res.set('Content-Type', 'text/html').send(template.modifiedHtml);
});

export default router;