import express from 'express';
import Miscellaneous from './utils/misc.js';
import ProjectConfigs from './utils/data/configs.js';
import {logDebug, logTags} from './utils/log/logger.js';

// route imports
import logs from './routes/logs.js';
import index from './routes/index.js';
import login from './routes/login.js';
import track from './routes/track.js';
import preview from './routes/preview.js';
import settings from './routes/settings.js';
import password from './routes/password.js';
import published from './routes/published.js';
import analytics from './routes/analytics.js';
import newsletters from './routes/newsletters.js';

const expressApp = express();
await Miscellaneous.setup(expressApp);

// define routes
logDebug('Express', 'Setting routes...');
expressApp.use(track);
expressApp.use(login);
expressApp.use('/', index);
expressApp.use('/logs', logs);
expressApp.use('/preview', preview);
expressApp.use('/settings', settings);
expressApp.use('/password', password);
expressApp.use('/analytics', analytics);
expressApp.use('/published', published);
expressApp.use('/newsletters', newsletters);

// custom 404 after all the pages have been set up.
expressApp.use((req, res) => res.status(404).render('errors/404'));

logDebug(logTags.Express, 'Routes configured!');

// start the app with given port!
ProjectConfigs.ghosler().then(configs => {
    expressApp.listen(configs.port);
    logDebug(logTags.Express, 'App started successfully!');
    logDebug(logTags.Express, '============================');
});
