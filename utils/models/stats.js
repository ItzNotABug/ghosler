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
     * @param {string} [newsletterName=''] - The name of the post's newsletter.
     * @param {string} [newsletterStatus='na'] - The status of the post's newsletter.
     * @param {{[key: string]: number}[]} [postContentTrackedLinks=[]] - The urls that will be tracked when a user clicks on them in the email.
     */
    constructor(
        members = 0,
        emailsSent = 0,
        emailsOpened = '',
        newsletterName = '',
        newsletterStatus = 'na',
        postContentTrackedLinks = [],
    ) {
        this.members = members;
        this.emailsSent = emailsSent;
        this.emailsOpened = emailsOpened;
        this.newsletterName = newsletterName;
        this.newsletterStatus = newsletterStatus;
        this.postContentTrackedLinks = postContentTrackedLinks;
    }
}
