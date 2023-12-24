import express from 'express';
import Miscellaneous from '../utils/misc.js';

const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res) => {
    const authStatus = await Miscellaneous.authenticated(req);
    if (authStatus.level === 'success') return res.redirect('/');
    else return res.render('login', authStatus);
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


export default router;