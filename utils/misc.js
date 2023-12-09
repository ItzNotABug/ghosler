import express from 'express';
import crypto from 'node:crypto';
import Files from './data/files.js';
import ProjectConfigs from './data/configs.js';
import {logDebug, logTags} from './log/logger.js';

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

        expressApp.get('*', async (req, res, next) => {
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
}
