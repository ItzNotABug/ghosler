import ProjectConfigs from '../data/configs.js';
import GhostAdminAPI from '@tryghost/admin-api';
import Subscriber from '../models/subscriber.js';

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
        return true;
        // const settings = await this.#settings();
        //
        // // supposed to be an array of objects but lets check anyway!
        // if (Array.isArray(settings)) {
        //     const commentsSettingsKey = 'comments_enabled';
        //     const settingObject = settings.filter(obj => obj.key === commentsSettingsKey)[0];
        //     const commentsEnabled = settingObject ? settingObject.value !== 'off' : true;
        //     logToConsole(logTags.Ghost, `Site comments enabled: ${commentsEnabled}`);
        //     return commentsEnabled;
        // } else {
        //     // no idea about this unknown structure, return a default value!
        //     logToConsole(logTags.Ghost, 'Could not check if the site has comments enabled, defaulting to true');
        //     return true;
        // }
    }

    /**
     * Read the site's settings. We especially check if the site has comments enabled.
     *
     * **Be Careful: This api is not officially baked into GhostAdminAPI & is added manually!
     * This can change anytime! See: https://github.com/TryGhost/Ghost/issues/19271**.
     *
     * @returns {Promise<Object[]>}
     */
    // async #settings() {
    //     const ghost = await this.#ghost();
    //     return await ghost.settings.read();
    // }

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