import Miscellaneous from '../misc.js';

/**
 * A class that represents a user on the site who has enabled receiving the newsletters via email.
 */
export default class Subscriber {
    constructor(uuid, name, email, status, created, newsletters = [], subscriptions = []) {
        this.uuid = uuid;
        this.name = name;
        this.email = email;
        this.status = status;
        this.newsletters = newsletters;
        this.subscriptions = subscriptions;
        this.created = Miscellaneous.formatDate(created);

        if (status === 'comped') this.status = 'complimentary';
    }

    /**
     * Static utility method to generate an instance of Subscriber from a json object.
     *
     * @param {Object} jsonObject
     * @returns {Subscriber}
     */
    static make(jsonObject) {
        return new Subscriber(
            jsonObject.uuid,
            jsonObject.name,
            jsonObject.email,
            jsonObject.status,
            jsonObject.created_at,
            jsonObject.newsletters,
            jsonObject.subscriptions
        );
    }

    /**
     * Check if this is a paying subscriber.
     *
     * @param {string[]} tierIds The tier ids to check against.
     * @returns {boolean} True if this is a paying member & has an active subscription.
     */
    isPaying(tierIds) {
        const hasTier = this.subscriptions.some(subscription => tierIds.includes(subscription.tier.id));

        // possible values are 'active', 'expired', 'canceled'.
        // also see why we use the first subscription object:
        // https://forum.ghost.org/t/one-tier-or-multiple-tiers-per-user/25848/2
        return hasTier && this.subscriptions[0].status === 'active';
    }

    /**
     * Check if this subscriber is subscribed to a given newsletter id.
     *
     * @param {string|null} newsletterId The id of the newsletter to check against.
     * @returns {boolean} True if the subscriber has subscribed to the given newsletter id, or true by default if newsletterId is null.
     */
    isSubscribedTo(newsletterId = null) {
        // probably only one newsletter exists.
        if (newsletterId === null) return true;
        else return this.newsletters.some(newsletter => newsletter.id === newsletterId);
    }
}