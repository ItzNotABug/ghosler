import Files from '../files.js';
import {logDebug, logError, logTags} from '../../log/logger.js';

/**
 * A queue class for batching and processing updates to links click tracking statistics.
 */
export default class LinksQueue {

    /**
     * Creates a new Queue instance.
     *
     * @param {number} [delay=10000] - The delay in milliseconds before processing the queue.
     */
    constructor(delay = 10000) {
        this.delay = delay;
        this.queue = new Map();
        this.timer = null;
    }

    /**
     * Adds a link stat update to the queue.
     *
     * @param {string} postId - The ID of the post.
     * @param {string} url - The URL whose count needs to be updated.
     */
    add(postId, url) {
        if (!this.queue.has(postId)) this.queue.set(postId, new Map());

        const postLinks = this.queue.get(postId);

        // Increment the count for the specific link
        if (!postLinks.has(url)) postLinks.set(url, 1);
        else {
            let currentCount = postLinks.get(url);
            postLinks.set(url, currentCount + 1);
        }

        // Reset the timer
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.#processQueue(), this.delay);
    }

    /**
     * Internal method to process the queued updates.
     */
    async #processQueue() {
        const updatePromises = [];

        // Iterate over each post and its associated links and counts
        for (const [postId, urlsMap] of this.queue) {
            updatePromises.push(this.#updateFile(postId, urlsMap));
        }

        await Promise.allSettled(updatePromises);

        this.queue.clear();
    }

    /**
     * Internal method to update the file with the queued changes.
     *
     * @param {string} postId - The ID of the post.
     * @param {Map<string, number>} urlStats - A map of links and their updated click counts.
     */
    async #updateFile(postId, urlStats) {
        try {
            const post = await Files.get(postId);
            if (!post) return;

            post.stats.postContentTrackedLinks.forEach(linkObject => {
                const linkUrl = Object.keys(linkObject)[0];
                if (urlStats.has(linkUrl)) linkObject[linkUrl] += urlStats.get(linkUrl);
            });

            const saved = await Files.create(post, true);
            if (saved) {
                logDebug(logTags.Stats, `Batched link click tracking updated for post: ${post.title}.`);
            }
        } catch (error) {
            logError(logTags.Stats, error);
        }
    }
}