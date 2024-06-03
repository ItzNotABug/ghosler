import express from 'express';
import Files from '../utils/data/files.js';

const router = express.Router();

router.get('/', (req, res) => res.redirect('/logs/debug'));

router.get('/:type', async (req, res) => {
    const logType = req.params.type;
    res.render('dashboard/logs', await Files.logs(logType ?? 'debug'));
});

router.get('/clear/:type', async (req, res) => {
    const logType = req.params.type;
    await Files.clearLogs(logType);
    res.redirect(`/logs/${logType}`);
});

export default router;
