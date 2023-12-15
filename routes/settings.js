import express from 'express';
import Ghost from '../utils/api/ghost.js';
import ProjectConfigs from '../utils/data/configs.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const configs = await ProjectConfigs.all();
    res.render('dashboard/settings', {configs: configs});
});

router.post('/', async (req, res) => {
    const formData = req.body;
    formData['ghosler.url'] = req.protocol + '://' + req.hostname;

    const result = await ProjectConfigs.update(formData);
    const configs = await ProjectConfigs.all();

    const {level, message} = result;

    if (configs.ghost.url && configs.ghost.key) {
        const ghost = new Ghost();
        const response = await ghost.registerWebhook();
        if (response.level === 'error') {
            res.render('index', response);
            return;
        }
    }

    res.render('dashboard/settings', {level, message, configs});
});


export default router;