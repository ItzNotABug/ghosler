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
     * Returns the registered members, currently subscribed to a newsletter.\
     * Uses pagination to get all the users, then filter them.
     *
     * @returns {Promise<Subscriber[]>} List of Subscribers.
     */
    async members() {
        let page = 1;
        let members = [];

        const ghost = await this.#ghost();

        while (true) {
            const registeredMembers = await ghost.members.browse({page: page});
            members.push(...registeredMembers);

            if (registeredMembers.meta.pagination.next !== null) {
                page = registeredMembers.meta.pagination.next;
            } else {
                break;
            }
        }

        // hardcoded to the first newsletter!
        // TODO: support multiple newsletters?
        //  We could use internal tags system.
        return members.reduce((activeSubscribers, member) => {
            const subscriber = Subscriber.make(member);
            const isActive = subscriber.newsletters.some(nls => nls.status === "active");

            if (isActive) activeSubscribers.push(subscriber);
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

        try {
            await ghost.webhooks.add({
                name: 'Ghosler Webhook',
                event: 'post.published',
                target_url: `${ghosler.url}/published`,
            });

            return {level: 'success', message: 'Webhook created successfully.'};
        } catch (error) {
            const context = error.context;
            if (context === 'Target URL has already been used for this event.') {
                return {level: 'success', message: 'Webhook exists for this API Key.'};
            } else {
                logError(logTags.Ghost, error);
                return {level: 'error', message: 'Webhook creation failed, see error logs.'};
            }
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

    // GhostAdminAPI
    async #ghost() {
        const ghost = await ProjectConfigs.ghost();
        return new GhostAdminAPI({
            url: ghost.url,
            key: ghost.key,
            version: ghost.version
        });
    }
}