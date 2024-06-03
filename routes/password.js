import express from 'express';
import ProjectConfigs from '../utils/data/configs.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.render('dashboard/password');
});

router.post('/', async (req, res) => {
    const formData = req.body;
    const result = await ProjectConfigs.update(formData, true);
    res.render('dashboard/password', result);
});

export default router;
