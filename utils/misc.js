import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import Files from './data/files.js';
import ProjectConfigs from './data/configs.js';
import {logDebug, logError, logTags} from './log/logger.js';

/**
 * This class provides general utility methods.
 */
export default class Miscellaneous {

    /**
     * Set up miscellaneous middlewares and configurations for a given express app instance.
     *
     * @param {Express} expressApp
     * @returns {Promise<void>} Nothing.
     */
    static async setup(expressApp) {
        expressApp.set('view engine', 'ejs');
        expressApp.use(express.static("public"));
        expressApp.use(express.json({limit: '50mb'}));
        expressApp.use(express.urlencoded({extended: true, limit: '50mb'}));

        // Safeguard
        Files.makeFilesDir().then();

        logDebug(logTags.Express, '============================');
        logDebug(logTags.Express, 'View-engine set!');

        // the site might be behind a proxy.
        expressApp.enable('trust proxy');
        expressApp.all('*', async (req, res, next) => {
            const path = req.path;
            if (['/analytics', '/logs', '/settings', '/password'].some(prefix => path.startsWith(prefix))) {
                const authenticated = await Miscellaneous.authenticated(req);

                if (authenticated) return next();
                else {
                    res.setHeader('WWW-Authenticate', 'Basic realm="401"');
                    res.status(401).render('errors/401');
                }
            } else next();
        });

    }

    /**
     * Generates a 1x1 pixel transparent GIF image.
     *
     * @returns {Buffer} A Buffer object containing the binary data of a 1x1 pixel transparent GIF.
     */
    static trackingPixel() {
        return Buffer.from(
            'R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'
        );
    }

    /**
     * Checks if the user is authenticated via Basic Auth.
     *
     * @param {*} req The express request object.
     * @returns {Promise<boolean>} Authentication status.
     */
    static async authenticated(req) {
        const ghosler = await ProjectConfigs.ghosler();
        const authHeader = req.headers['authorization'] || '';
        const [type, encoded] = authHeader.split(' ');

        if (type === 'Basic' && encoded) {
            const decoded = this.decode(encoded);
            const [usr, pwd] = decoded.split(':');
            return usr === ghosler.auth.user && this.hash(pwd) === ghosler.auth.pass;
        }

        return false;
    }

    /**
     * Converts an ISO date string to a more readable "DD MMM YYYY" format.
     *
     * @param {string} dateString The ISO date string to be formatted.
     * @returns {string} The formatted date in "DD MMM YYYY" format.
     */
    static formatDate(dateString) {
        const date = new Date(dateString);

        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    }

    /**
     * Encodes a given string to Base64 format.
     *
     * @param {string} data The string to be encoded.
     * @returns {string} The Base64 encoded string.
     */
    static encode(data) {
        return btoa(data);
    }

    /**
     * Decodes a Base64 encoded string.
     *
     * @param {string} data The Base64 encoded string to be decoded.
     * @returns {string} The decoded string.
     */
    static decode(data) {
        return atob(data);
    }

    /**
     * Hash a given input with md5.
     *
     * @param data The data to hash.
     * @returns {string} MD5 hashed value of the given data.
     */
    static hash(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Validate if the incoming webhook contains valid secret key.
     *
     * @param {express.Request} request - The express request object.
     * @return {Promise<boolean>} True if valid, false otherwise.
     */
    static async isPostSecure(request) {
        const payload = JSON.stringify(request.body);
        const ghostConfigs = await ProjectConfigs.ghost();
        const signatureWithDateHeader = request.headers['x-ghost-signature'];

        // Secret set on Ghosler but not recd. in the request headers.
        if (ghostConfigs.secret && !signatureWithDateHeader) {
            logError(logTags.Express, 'The \'X-Ghost-Signature\' header not found in the request. Did you setup the Secret Key correctly?');
            return false;
        }

        const signatureAndTimeStamp = signatureWithDateHeader.split(', ');

        // @see: https://github.com/TryGhost/Ghost/blob/efb2b07c601cd557976bcbe12633f072da5c22a7/ghost/core/core/server/services/webhooks/WebhookTrigger.js#L98
        const signature = signatureAndTimeStamp[0].replace('sha256=', '');
        const timeStamp = parseInt(signatureAndTimeStamp[1].replace('t=', ''));
        if (!signature || isNaN(timeStamp)) {
            logError(logTags.Express, 'Either the signature or the timestamp in the \'X-Ghost-Signature\' header is not valid or doesn\'t exist.');
            return false;
        }

        const maxTimeDiff = 5 * 60 * 1000; // 5 minutes
        if (Math.abs(Date.now() - timeStamp) > maxTimeDiff) {
            logError(logTags.Express, 'The timestamp in the \'X-Ghost-Signature\' header exceeds 5 minutes.');
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', ghostConfigs.secret)
            .update(payload).digest('hex');

        return signature === expectedSignature;
    }

    /**
     * Generate a token for Ghost request authentication.
     *
     * @param {String} key - API key to sign JWT with
     * @param {String} audience - token audience
     *
     * @returns {string} Token for the web requests.
     */
    static ghostToken(key, audience) {
        const [id, secret] = key.split(':');

        return jwt.sign({}, Buffer.from(secret, 'hex'), {
            keyid: id, algorithm: 'HS256', expiresIn: '5m', audience
        });
    }
}
