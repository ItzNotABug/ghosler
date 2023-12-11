import path from 'path';
import fs from 'fs/promises';
import BitSet from '../bitset.js';
import {logDebug, logError, logTags} from '../log/logger.js';

/**
 * This class manages the analytics for each post sent via email as a newsletter.
 */
export default class Files {

    /**
     * Get the files' directory.
     */
    static #filesPath() {
        return path.join(process.cwd(), 'files');
    }

    /**
     * Get the logs' directory.
     */
    static #logsPath() {
        return path.join(process.cwd(), '.logs');
    }

    /**
     * * Asynchronously creates a JSON file with a specified name in a predefined directory.
     *
     * @param {Object} post - The post data to be saved as a file.
     * @param {boolean} update - Update the file if true.
     * @returns {Promise<boolean>} A promise that resolves to true when the file is successfully created,
     *                          or rejects with false if an error occurs or if it already exists.
     */
    static async create(post, update = false) {
        // Define the directory and file path
        const filePath = path.join(this.#filesPath(), `${post.id}.json`);

        const isExists = await this.exists(post.id);
        if (!update && isExists) return false;

        try {
            // create files directory.
            await this.makeFilesDir();

            // Initialize / Update the file with provided post object.
            await fs.writeFile(filePath, JSON.stringify(post), 'utf8');

            return true;
        } catch (error) {
            logError(logTags.Files, error);
            return false;
        }
    }

    /**
     * Gets the post data for the given postId.
     *
     * @param {string} postId - The ID of the post.
     * @returns {Promise<Object|undefined>} The post data if found, otherwise undefined.
     */
    static async get(postId) {
        const isExists = await this.exists(postId);
        if (!isExists) return undefined;

        else {
            const filePath = path.join(this.#filesPath(), `${postId}.json`);

            try {
                const data = await fs.readFile(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                logError(logTags.Files, error);
                return undefined;
            }
        }
    }

    /**
     * Checks if a file exists.
     *
     * @param {string} name - The name of the file to check.
     * @returns {Promise<boolean>} A promise that resolves to true if the file exists, false otherwise.
     */
    static async exists(name) {
        const filePath = path.join(process.cwd(), 'files', `${name}.json`);

        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Deletes post data for a given postId.
     *
     * @param postId The id of the post to be deleted.
     * @returns {Promise<boolean>} True if deletion succeeded, false otherwise.
     */
    static async delete(postId) {
        const filePath = path.join(this.#filesPath(), `${postId}.json`);

        const isExists = await this.exists(postId);
        if (!isExists) return true;

        try {
            await fs.rm(filePath);
            logDebug(logTags.Files, `Post data for Id: ${postId} deleted.`);
            return true;
        } catch (error) {
            logError(logTags.Files, error);
            return false;
        }
    }

    /**
     * Get all the data from all files for analysis.
     */
    static async all() {
        try {
            // Get all file names in the files directory
            const files = await fs.readdir(this.#filesPath());

            let totalPosts = 0;
            let totalSent = 0;
            let totalOpens = 0;

            const analytics = await Promise.all(files.map(async (file) => {
                const filePath = path.join(this.#filesPath(), file);
                const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

                const numbered = new BitSet(data.stats.emailsOpened ?? '').popCount();

                totalPosts += 1;
                totalOpens += numbered;
                totalSent += data.stats.emailsSent ? data.stats.emailsSent : 0;

                data.stats.emailsOpened = numbered;

                return data;
            }));

            const overview = {
                posts: totalPosts,
                sent: totalSent,
                opens: totalOpens
            };

            return {overview, analytics};
        } catch (error) {
            logError(logTags.Files, error);
            return {overview: {posts: 0, sent: 0, opens: 0}, analytics: []};
        }
    }

    /**
     * Get the logs from the log files.
     *
     * @param {string} type The type of log. Can be debug or error.
     * @returns {Promise<Object>} Contents of the log file, empty object if an error occurred.
     */
    static async logs(type) {
        const filePath = path.join(this.#logsPath(), `${type}.log`);

        try {
            let logContent = await fs.readFile(filePath, 'utf8');
            logContent = this.#reverseLogEntries(logContent);

            return {content: logContent, level: type};
        } catch (error) {
            if (error.toString().includes('no such file or directory')) {
                // Check and create the directory if it doesn't exist
                const logDir = this.#logsPath();
                await this.makeFilesDir(logDir);

                // Now that the directory is ensured to exist, write the file
                const newFilePath = path.join(logDir, `${type}.log`);
                await fs.writeFile(newFilePath, '', 'utf-8');
            } else logError(logTags.Files, error);

            // empty anyway!
            return {content: '', level: type};
        }
    }

    /**
     * Create a directory with given name if it doesn't exist.
     *
     * @param {string} directory Name of the directory. Default is 'files'.
     * @returns {Promise<void>}
     */
    static async makeFilesDir(directory = this.#filesPath()) {
        // Create if it doesn't exist.
        await fs.mkdir(directory, {recursive: true});
    }

    /**
     * Reverses the order of log entries in a given log content string.
     * Assumes that each log entry starts with a timestamp in the format [YYYY-MM-DD HH:MM:SS UTC].
     *
     * @param {string} logContent - The log content to be reversed.
     * @returns {string} The log content with the order of entries reversed.
     */
    static #reverseLogEntries(logContent) {
        const entryPattern = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC]/;
        const entries = [];
        let currentEntry = [];

        logContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (entryPattern.test(trimmedLine)) {
                if (currentEntry.length) {
                    entries.push(currentEntry.join('\n'));
                }
                currentEntry = [];
            }
            if (trimmedLine) {
                currentEntry.push(trimmedLine);
            }
        });

        // Add the last entry
        if (currentEntry.length) {
            entries.push(currentEntry.join('\n'));
        }

        // Reverse and join the entries, no additional newlines are needed
        return entries.reverse().join('\n');
    }
}