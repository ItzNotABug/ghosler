import express from 'express';
import ProjectConfigs from '../utils/data/configs.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const configs = await ProjectConfigs.all();
    res.render('settings', {configs: configs});
});

router.post('/', async (req, res) => {
    const formData = req.body;
    formData['ghosler.url'] = req.protocol + '://' + req.hostname;

    const result = await ProjectConfigs.update(formData);
    const configs = await ProjectConfigs.all();

    const {level, message} = result;
    res.render('settings', {level, message, configs});
});


export default router;