import Miscellaneous from '../misc.js';

/**
 * A class that represents a user on the site who has enabled receiving the newsletters via email.
 */
export default class Subscriber {
    constructor(uuid, email, name, status, created, newsletters = []) {
        this.uuid = uuid;
        this.email = email;
        this.name = name;
        this.status = status;
        this.created = Miscellaneous.formatDate(created);
        this.newsletters = newsletters;
    }

    /**
     * Static utility method to generate an instance of Subscriber from a json object.
     *
     * @param {Object} jsonObject
     * @returns {Subscriber}
     */
    static make(jsonObject) {
        return new Subscriber(jsonObject.uuid, jsonObject.email, jsonObject.name, jsonObject.status, jsonObject.created_at, jsonObject.newsletters);
    }
}