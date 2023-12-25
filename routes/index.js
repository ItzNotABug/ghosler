import express from 'express';
import ProjectConfigs from '../utils/data/configs.js';
import Miscellaneous from '../utils/misc.js';

const router = express.Router();

router.get('/', async (_, res) => {
    const configs = await ProjectConfigs.all();

    if (configs.ghosler.auth.user === 'ghosler' &&
        configs.ghosler.auth.pass === Miscellaneous.hash('admin')
    ) {
        res.render('index', {
            level: 'error',
            message: 'Update your username and password.<br><br>Default - <br>Username: ghosler, Password: admin'
        });
    } else if (configs.ghost.url === '' || configs.ghost.key === '') {
        res.render('index', {
            level: 'error',
            message: 'Set up your Ghost Site Url & add an Admin API Key.'
        });
    } else if (configs.mail.length === 0) {
        res.render('index', {
            level: 'error',
            message: 'Add email credentials to send newsletters.'
        });
    } else res.render('index');
});

export default router;