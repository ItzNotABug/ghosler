import ejs from 'ejs';
import express from 'express';
import Files from '../utils/data/files.js';
import Newsletter from '../utils/newsletter.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const preview = await Newsletter.preview();

    if (await Files.customTemplateExists()) {
        const templatePath = Files.customTemplatePath();
        const template = await ejs.renderFile(templatePath, preview);
        res.set('Content-Type', 'text/html').send(Buffer.from(template));
    } else res.render('newsletter', preview);
});

export default router;