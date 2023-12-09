import express from 'express';
import ProjectConfigs from '../utils/data/configs.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.render('password');
});

router.post('/', async (req, res) => {
    const formData = req.body;
    const result = await ProjectConfigs.update(formData, true);
    res.render('password', result);
});


export default router;