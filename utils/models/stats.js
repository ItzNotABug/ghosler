/**
 * Represents statistics related to a Post.
 */
export default class Stats {

    /**
     * Creates an instance of Stats.
     * 
     * @param {number} [members] - Count of members who should receive the newsletter.
     * @param {number} [emailsSent=0] - The count of emails sent related to this Post.
     * @param {string} [emailsOpened=''] - The statistics of opened emails for this Post.
     * @param {string} [newsletterStatus='na'] - The status of the post's newsletter.
     */
    constructor(
        members = 0,
        emailsSent = 0,
        emailsOpened = '',
        newsletterStatus = 'na',
    ) {
        this.members = members;
        this.emailsSent = emailsSent;
        this.emailsOpened = emailsOpened;
        this.newsletterStatus = newsletterStatus;
    }
}