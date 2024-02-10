import Miscellaneous from '../misc.js';
import GhostAdminAPI from '@tryghost/admin-api';
import ProjectConfigs from '../data/configs.js';
import Subscriber from '../models/subscriber.js';
import {logError, logTags, logToConsole} from '../log/logger.js';

/**
 * Class that handles api calls with Ghost's Admin APIs.
 */
export default class Ghost {

    /**
     * Returns the ghost site data.
     *
     * @returns {Promise<Object>} The ghost site data.
     */
    async site() {
        const ghost = await this.#ghost();
        return await ghost.site.read();
    }

    /**
     * Returns the number of 'active' newsletters.
     *
     * @returns {Promise<number>} The number of active newsletters.
     */
    async newslettersCount() {
        const newsletters = await this.newsletters();
        return newsletters.meta?.pagination?.total ?? 0;
    }

    /**
     * Returns all the 'active' newsletters.
     *
     * @returns {Promise<Array<{id: string, name: string, description: string}>>} An array of newsletter objects.
     */
    async newsletters() {
        const ghost = await this.#ghost();
        return await ghost.newsletters.browse({
            limit: 'all',
            filter: 'status:active',
            fields: 'id,name,description',
        });
    }

    /**
     * Returns sentiment and feedback counts for a specific post.
     *
     * @param {string} postId - The ID of the post.
     * @returns {Promise<{ sentiment: number, negative_feedback: number, positive_feedback: number }>} - An object containing sentiment data and feedback counts.
     */
    async postSentiments(postId) {
        const ghost = await this.#ghost();
        try {
            const postInfo = await ghost.posts.read({
                id: postId,
                include: 'sentiment,count.positive_feedback,count.negative_feedback'
            });

            const {count, sentiment} = postInfo;
            const {negative_feedback, positive_feedback} = count;

            return {
                sentiment,
                negative_feedback,
                positive_feedback
            };
        } catch (error) {
            if (error.name !== 'NotFoundError') logError(logTags.Ghost, error);
            else {
                // ignore, the post is probably deleted or the provided ID is wrong.
            }

            return {
                sentiment: 0,
                negative_feedback: 0,
                positive_feedback: 0
            };
        }
    }

    /**
     * Returns the registered members, currently subscribed to a newsletter.\
     * Uses pagination to get all the users, then filter them.
     *
     * @param {string|null} newsletterId The newsletter id to get members associated with it.
     * @returns {Promise<Subscriber[]>} List of Subscribers.
     */
    async members(newsletterId = null) {
        let page = 1;
        let subscribedMembers = [];

        const ghost = await this.#ghost();

        while (true) {
            const registeredMembers = await ghost.members.browse({
                    page: page,
                    filter: 'subscribed:true'
                }
            );

            subscribedMembers.push(...registeredMembers);

            if (registeredMembers.meta.pagination.next) {
                page = registeredMembers.meta.pagination.next;
            } else {
                break;
            }
        }

        return subscribedMembers.reduce((activeSubscribers, member) => {
            const subscriber = Subscriber.make(member);
            if (subscriber.isSubscribedTo(newsletterId)) activeSubscribers.push(subscriber);
            return activeSubscribers;
        }, []);
    }

    /**
     * Check if the site has enabled comments.
     *
     * Returns true until this is supported by the api.
     *
     * @returns {Promise<boolean>}
     */
    async hasCommentsEnabled() {
        try {
            const settings = await this.#settings();

            // supposed to be an array of objects but lets check anyway!
            if (Array.isArray(settings)) {
                const commentsSettingsKey = 'comments_enabled';
                const settingObject = settings.filter(obj => obj.key === commentsSettingsKey)[0];
                const commentsEnabled = settingObject ? settingObject.value !== 'off' : true;
                logToConsole(logTags.Ghost, `Site comments enabled: ${commentsEnabled}`);
                return commentsEnabled;
            } else {
                // no idea about this unknown structure, return a default value!
                logToConsole(logTags.Ghost, 'Could not check if the site has comments enabled, defaulting to true');
                return true;
            }
        } catch (error) {
            logError(logTags.Ghost, error);
            return true;
        }
    }

    /**
     * Returns a list of latest post.
     *
     * @param {string} currentPostId Current post id.
     * @returns {Promise<[Object]>}
     */
    async latest(currentPostId) {
        const ghost = await this.#ghost();
        return await ghost.posts.browse({
            filter: `status:published+id:-${currentPostId}`,
            order: 'published_at DESC', limit: 3,
            fields: 'title, custom_excerpt, excerpt, url, feature_image'
        });
    }

    /**
     * Registers a webhook to receive post data on publish if one doesn't exist.
     *
     * **Note:** Ignored when running on localhost.
     *
     * @returns {Promise<{level: string, message: string}>}
     */
    async registerWebhook() {
        const ghosler = await ProjectConfigs.ghosler();
        if (ghosler.url === '' || ghosler.url.includes('localhost')) {
            return {level: 'warning', message: 'Ignore webhook check.'};
        }

        const ghost = await this.#ghost();
        const secret = (await ProjectConfigs.ghost()).secret;
        if (!secret || secret === '') {
            return {level: 'error', message: 'Secret is not set or empty or is less than 8 characters.'};
        }

        try {
            await ghost.webhooks.add({
                name: 'Ghosler Webhook',
                event: 'post.published',
                target_url: `${ghosler.url}/published`,
                secret: secret,
            });

            return {level: 'success', message: 'Webhook created successfully.'};
        } catch (error) {
            const context = error.context;
            if (error.name === 'UnauthorizedError') {
                return {level: 'error', message: 'Unable to check for Webhook, Ghost Admin API not valid.'};
            } else if (context === 'Target URL has already been used for this event.') {
                return {level: 'success', message: 'Webhook exists for this API Key.'};
            } else {
                logError(logTags.Ghost, error);
                return {level: 'error', message: 'Webhook creation failed, see error logs.'};
            }
        }
    }

    /**
     * Add a private, internal tag to ignore a post for newsletter.
     *
     * **Note:** Ignored when running on localhost.
     *
     * @returns {Promise<{level: string, message: string}>}
     */
    async registerIgnoreTag() {
        const ghosler = await ProjectConfigs.ghosler();
        if (ghosler.url === '' || ghosler.url.includes('localhost')) {
            return {level: 'warning', message: 'Ignore tag check.'};
        }

        try {
            const ghost = await this.#ghost();
            const ignoreTagSlug = 'ghosler_ignore';

            // check if one already exists with given slug.
            const exists = await this.#ignoreTagExists(ghost, ignoreTagSlug);
            if (exists) return {level: 'success', message: 'Ghosler ignore tag already exists.'};

            await ghost.tags.add({
                slug: ignoreTagSlug,
                name: '#GhoslerIgnore',
                visibility: 'internal', // using # anyway makes it internal.
                accent_color: '#0f0f0f',
                description: 'Any post using this tag will be ignore by Ghosler & will not be sent as a newsletter email.'
            });

            return {level: 'success', message: 'Ignore tag created successfully.'};
        } catch (error) {
            logError(logTags.Ghost, error);
            return {level: 'error', message: 'Ignore tag creation failed, see error logs.'};
        }
    }

    /**
     * Check if a given exists or not.
     *
     * @param {GhostAdminAPI} ghost
     * @param {string} tagSlug
     *
     * @returns {Promise<boolean>}
     */
    async #ignoreTagExists(ghost, tagSlug) {
        try {
            await ghost.tags.read({slug: tagSlug});
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Read the site's settings. We especially check if the site has comments enabled.
     *
     * **Be Careful: This api is not officially baked into GhostAdminAPI & is added manually!
     * This can change anytime! See: https://github.com/TryGhost/Ghost/issues/19271**.
     *
     * @returns {Promise<Object[]>}
     */
    async #settings() {
        const ghost = await ProjectConfigs.ghost();
        let token = `Ghost ${Miscellaneous.ghostToken(ghost.key, '/admin/')}`;
        const ghostHeaders = {Authorization: token, 'User-Agent': 'GhostAdminSDK/1.13.11'};

        const response = await fetch(`${ghost.url}/ghost/api/admin/settings`, {headers: ghostHeaders});
        if (!response.ok) {
            // will be caught by the calling function anyway.
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonResponse = await response.json();
        return jsonResponse.settings;
    }

    /** @returns {Promise<GhostAdminAPI>} */
    async #ghost() {
        const ghost = await ProjectConfigs.ghost();
        return new GhostAdminAPI({
            url: ghost.url,
            key: ghost.key,
            version: ghost.version
        });
    }
}