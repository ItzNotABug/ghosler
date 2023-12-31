import express from 'express';
import Miscellaneous from '../utils/misc.js';

const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login', {redirect: req.query.redirect ?? ''});
});

router.post('/login', async (req, res) => {
    const authStatus = await Miscellaneous.authenticated(req);
    if (authStatus.level === 'success') {
        let redirect = req.body.redirect;
        if (!redirect) redirect = '/';

        return res.redirect(redirect);
    } else return res.render('login', authStatus);
});

router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});


export default router;