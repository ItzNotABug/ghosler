import Files from './files.js';
import BitSet from '../bitset.js';
import Miscellaneous from '../misc.js';
import {logDebug, logError, logTags} from '../log/logger.js';

/**
 * A queue class for batching and processing updates to tracking statistics.
 */
export default class Queue {

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
     * Adds an update to the queue.
     *
     * @param {string} encodedUUID - The base64 encoded UUID consisting of postId and memberIndex.
     */
    async add(encodedUUID) {
        const uuid = Miscellaneous.decode(encodedUUID);
        const [postId, memberIndex] = uuid.split('_');

        if (!this.queue.has(postId)) {
            this.queue.set(postId, new Set());
        }

        this.queue.get(postId).add(parseInt(memberIndex));

        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.#processQueue(), this.delay);
    }

    /**
     * Internal method to process the queued updates.
     */
    async #processQueue() {
        const updatePromises = [];
        for (const [postId, memberIndexes] of this.queue) {
            updatePromises.push(this.#updateFile(postId, Array.from(memberIndexes)));
        }

        await Promise.allSettled(updatePromises);

        this.queue.clear();
    }

    /**
     * Internal method to update the file with the queued changes.
     *
     * @param {string} postId - The ID of the post.
     * @param {number[]} memberIndexes - Array of member indexes to be updated.
     */
    async #updateFile(postId, memberIndexes) {
        try {
            const post = await Files.get(postId);
            if (!post) return;

            const bitSet = new BitSet(post.stats.emailsOpened);
            memberIndexes.forEach(index => {
                if (bitSet.get(index) === 0) bitSet.set(index, 1);
            });

            post.stats.emailsOpened = bitSet.toString();

            const saved = await Files.create(post, true);
            if (saved) {
                logDebug(logTags.Stats, `Batched tracking updated for post: ${post.title}.`);
            }
        } catch (error) {
            logError(logTags.Stats, error);
        }
    }
}