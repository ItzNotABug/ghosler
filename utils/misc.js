import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import Files from './data/files.js';
import cookieSession from 'cookie-session';
import fileUpload from 'express-fileupload';
import ProjectConfigs from './data/configs.js';
import {extract} from '@extractus/oembed-extractor';
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
        expressApp.use(fileUpload({safeFileNames: true, preserveExtension: true, useTempFiles: false}));

        // login sessions.
        expressApp.use(cookieSession({
            name: 'ghosler',
            maxAge: 24 * 60 * 60 * 1000,
            secret: crypto.randomUUID(), // dynamic secret, always invalidated on a restart.
        }));

        // Safeguard
        await Files.makeFilesDir();

        logDebug(logTags.Express, '============================');
        logDebug(logTags.Express, 'View-engine set!');

        // the site might be behind a proxy.
        expressApp.enable('trust proxy');

        // add common data for response.
        expressApp.use(async (_, res, next) => {
            // add project version info for all render pages.
            res.locals.version = ProjectConfigs.ghoslerVersion;

            // add no robots header tag to all.
            res.header('X-Robots-Tag', 'noindex, nofollow');

            // provide ghosler.url to every view.
            const ghosler = await ProjectConfigs.ghosler();
            res.locals.ghoslerUrl = ghosler.url || '';

            // finally move ahead.
            next();
        });

        logDebug(logTags.Express, 'Robots managed!');

        // password protect, ignore a few endpoints.
        expressApp.all('*', async (req, res, next) => {
            const path = req.path;
            const isUnrestrictedPath = /\/login$|\/preview$|\/track/.test(path);
            const isPostPublish = req.method === 'POST' && /\/published$/.test(path);

            if (isUnrestrictedPath || isPostPublish) return next();

            if (req.session.user) return next();

            // redirect to page the user wanted to go to, after auth.
            const redirect = path !== '/' ? `?redirect=${encodeURIComponent(path)}` : '';
            res.status(401).redirect(`/login${redirect}`);
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
     * @returns {Promise<{level: string, message: string}>} Authentication status.
     */
    static async authenticated(req) {
        if (!req.body || !req.body.username || !req.body.password) {
            return {level: 'error', message: 'Please enter both Username & Password!'};
        }

        const {username, password} = req.body;
        const ghosler = await ProjectConfigs.ghosler();

        if (username === ghosler.auth.user && this.hash(password) === ghosler.auth.pass) {
            req.session.user = ghosler.auth.user;
            return {level: 'success', message: 'Successfully logged in!'};
        } else {
            return {level: 'error', message: 'Username or Password does not match!'};
        }
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
     * Converts to hh:mm:ss.xx format.
     *
     * @param durationInSeconds
     * @returns {string} Time in hh:mm:ss.xx format.
     */
    static formatDuration(durationInSeconds) {
        const totalSeconds = Number(durationInSeconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        let formattedDuration = `${String(seconds).padStart(2, '0')}`;
        if (minutes > 0 || hours > 0 || totalSeconds < 60) {
            formattedDuration = `${String(minutes).padStart(2, '0')}:${formattedDuration}`;
        }

        if (hours > 0) {
            formattedDuration = `${hours}:${formattedDuration}`;
        }

        return formattedDuration;
    }

    /**
     * Check if a given image url is from Unsplash.
     *
     * @param imageUrl - The url of the image to check.
     * @returns {boolean} True if the host name matches unsplash.
     */
    static detectUnsplashImage(imageUrl) {
        return /images\.unsplash\.com/.test(imageUrl);
    };

    /**
     * Removes the tracking if it exists and returns a clean url.
     *
     * @param {string} url - Url to clean.
     * @returns {string}
     */
    static getOriginalUrl(url) {
        let cleanUrl = url;
        if (cleanUrl.includes('/track/link?')) {
            const redirectIndex = cleanUrl.indexOf('&redirect=');
            if (redirectIndex !== -1) {
                cleanUrl = cleanUrl.slice(redirectIndex + '&redirect='.length);
                cleanUrl = decodeURIComponent(cleanUrl);
            }
        }

        return cleanUrl;
    }

    /**
     * Adds the tracking prefix to a given url.
     *
     * @param {string} url - Url to track.
     * @param {string} postId - The post id this url belongs to.
     * @returns {Promise<string>}
     */
    static async addTrackingToUrl(url, postId) {
        const ghosler = await ProjectConfigs.ghosler();
        return `${ghosler.url}/track/link?postId=${postId}&redirect=${url}`;
    }

    /**
     * Get thumbnail for a given oembed provided from url.
     *
     * @param url
     * @returns {Promise<string>}
     */
    static async thumbnail(url) {
        const extractedInfo = await extract(url);
        return extractedInfo.thumbnail_url;
    }

    /**
     * Check if a given object is empty.
     *
     * @param {Object} object
     * @returns {boolean}
     */
    static isObjectEmpty(object) {
        return Object.keys(object).length === 0;
    }

    /**
     * Sleep for a given period of time.
     *
     * @param {number} ms Milliseconds to sleep.
     * @returns {Promise<void>}
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
     * @returns {Promise<boolean>} True if valid, false otherwise.
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
