import Miscellaneous from '../misc.js';
import * as nodemailer from 'nodemailer';
import ProjectConfigs from '../data/configs.js';
import {logDebug, logError, logTags, logToConsole} from '../log/logger.js';

/**
 * Class responsible for sending newsletters to subscribers.
 */
export default class NewsletterMailer {

    /**
     * Creates an instance of NewsletterMailer.
     *
     * @param {Post} post - The post to be sent.
     * @param {Subscriber[]} subscribers - An array of subscribers.
     * @param {string|null} newsletterName - The name of the newsletter.
     * @param {string} fullContent - The HTML content of the email.
     * @param {string|undefined} partialContent - Partial HTML content of the email for non-paying users.
     * @param {string} unsubscribeLink - An unsubscribe link for the subscribers.
     */
    constructor(post, subscribers, newsletterName, fullContent, partialContent, unsubscribeLink) {
        this.post = post;
        this.subscribers = subscribers;
        this.newsletterName = newsletterName;
        this.fullContent = fullContent;
        this.partialContent = partialContent;
        this.unsubscribeLink = unsubscribeLink;
    }

    /**
     * Sends the newsletter to a list of subscribers.
     */
    async send() {
        this.post.stats.members = this.subscribers.length;
        this.post.stats.newsletterStatus = 'Sending';
        await this.post.update();

        logDebug(logTags.Newsletter, 'Initializing sending emails.');

        let totalEmailsSent = 0;
        const mailConfigs = await ProjectConfigs.mail();
        let tierIds = this.post.isPaid ? [...this.post.tiers.map(tier => tier.id)] : [];

        if (mailConfigs.length > 1 && this.subscribers.length > 1) {
            logDebug(logTags.Newsletter, 'More than one subscriber & email configs found, splitting the subscribers.');

            const chunkSize = Math.ceil(this.subscribers.length / mailConfigs.length);
            for (let i = 0; i < mailConfigs.length; i++) {

                // settings
                const mailConfig = mailConfigs[i];
                const emailsPerBatch = mailConfig.batch_size ?? 10;
                const delayPerBatch = mailConfig.delay_per_batch ?? 1250;
                const chunkedSubscribers = this.subscribers.slice(i * chunkSize, (i + 1) * chunkSize);

                // create required batches and send.
                const batches = this.#createBatches(chunkedSubscribers, emailsPerBatch);

                // we need increment this stat as we are inside a loop.
                totalEmailsSent += await this.#processBatches(mailConfig, batches, chunkSize, tierIds, delayPerBatch);
            }
        } else {
            logDebug(logTags.Newsletter, 'Single user or email config found, sending email(s).');

            // settings
            const mailConfig = mailConfigs[0];
            const emailsPerBatch = mailConfig.batch_size ?? 10;
            const delayPerBatch = mailConfig.delay_per_batch ?? 1250;

            // create required batches and send.
            const batches = this.#createBatches(this.subscribers, emailsPerBatch);
            totalEmailsSent = await this.#processBatches(mailConfig, batches, emailsPerBatch, tierIds, delayPerBatch);
        }

        // Update post status and save it.
        this.post.stats.newsletterStatus = 'Sent';
        this.post.stats.emailsSent = totalEmailsSent;
        this.post.stats.emailsOpened = '0'.repeat(totalEmailsSent);
        await this.post.update();

        logDebug(logTags.Newsletter, 'Email sending complete.');
    }

    /**
     * Sends an email to a single subscriber.
     *
     * @param {*} transporter - The nodemailer transporter.
     * @param {Object} mailConfig - Configs for the email.
     * @param {Subscriber} subscriber - The subscriber to send the email to.
     * @param {number} index - The index of the subscriber in the subscribers array.
     * @param {string} html - The original HTML content of the email.
     *
     * @returns {Promise<boolean>} - Promise resolving to true if email was sent successfully, false otherwise.
     */
    async #sendEmailToSubscriber(transporter, mailConfig, subscriber, index, html) {
        const correctHTML = this.#correctHTML(html, subscriber, index);
        const customSubject = await this.#makeEmailSubject(subscriber);

        try {
            const info = await transporter.sendMail({
                from: mailConfig.from,
                replyTo: mailConfig.reply_to,
                to: `"${subscriber.name}" <${subscriber.email}>`,
                subject: customSubject,
                html: correctHTML,
                list: {
                    unsubscribe: {
                        comment: 'Unsubscribe',
                        url: this.unsubscribeLink.replace('{MEMBER_UUID}', subscriber.uuid),
                    },
                },
                headers: {
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
                }
            });

            return info.response.includes('250');
        } catch (error) {
            logError(logTags.Newsletter, error);
            return false;
        }
    }

    /**
     * Generates the correct HTML content for the email by replacing placeholders.
     *
     * @param {string} html - The original HTML content.
     * @param {Subscriber} subscriber - The subscriber for whom the email is being sent.
     * @param {number} index - The index of the subscriber in the subscribers array.
     *
     * @returns {string} - The HTML content with placeholders replaced.
     */
    #correctHTML(html, subscriber, index) {
        let source = html
            .replace(/{MEMBER_UUID}/g, subscriber.uuid)
            .replace('Jamie Larson', subscriber.name) // default value due to preview
            .replace('19 September 2013', subscriber.created) // default value due to preview
            .replace('jamie@example.com', subscriber.email) // default value due to preview
            .replace('free subscriber', `${subscriber.status} subscriber`) // default value due to preview
            .replace('{TRACKING_PIXEL_LINK}', Miscellaneous.encode(`${this.post.id}_${index}`));

        if (subscriber.name === '') {
            // we use wrong class tag to keep the element visible,
            // use the right one to hide it as it is defined in the styles.
            source = source.replace(
                'class=\"wrong-user-subscription-name-field\"',
                'class=\"user-subscription-name-field\"'
            );
        }

        return source;
    }

    /**
     * Parse the custom subject pattern if exists.
     *
     * @param {Subscriber} subscriber
     * @returns {Promise<string>} The parsed subject.
     */
    async #makeEmailSubject(subscriber) {
        // already cached => fast path.
        const newsletterConfig = await ProjectConfigs.newsletter();
        let customSubject = newsletterConfig.custom_subject_pattern || this.post.title;

        customSubject = customSubject
            .replace('{{post_title}}', this.post.title)
            .replace('{{primary_author}}', this.post.primaryAuthor);

        // a post may not have a primary tag.
        if (customSubject.includes('{{primary_tag}}')) {
            if (this.post.primaryTag) customSubject = customSubject.replace('{{primary_tag}}', this.post.primaryTag);
            else customSubject = customSubject.replace(/( • #| • )?{{primary_tag}}/, '');
        }

        if (customSubject.includes('{{newsletter_name}}')) {
            const nlsName = this.newsletterName ?? subscriber.newsletters.filter(nls => nls.status === 'active')[0].name;
            customSubject = customSubject.replace('{{newsletter_name}}', nlsName);
        }

        return customSubject;
    }

    /**
     * Creates and configures a nodemailer transporter.
     *
     * @param {Object} mailConfig - Config for the email.
     *
     * @returns {Promise<*>} - The configured transporter.
     */
    async #transporter(mailConfig) {
        // Destructure from mailConfig, defaulting secure to true if not specified
        const { secure = true, host, port, auth } = mailConfig;
    
        // Initialize transport options
        const transportOptions = {
            secure,
            host,
            port
        };
    
        // Conditionally add auth if both user and pass are provided
        if (auth && auth.user && auth.pass) {
            transportOptions.auth = {
                user: auth.user,
                pass: auth.pass
            };
        }
    
        return nodemailer.createTransport(transportOptions);
    }

    /**
     * Creates batches of given subscribers.
     *
     * @param {Subscriber[]} subscribers - The array of subscribers to be batched.
     * @param {number} batchSize - The number of subscribers in each batch.
     *
     * @returns {Subscriber[][]} An array of subscriber arrays, where each inner array is a batch.
     */
    #createBatches(subscribers, batchSize) {
        const batches = [];
        if (subscribers.length <= batchSize) {
            return [subscribers];
        }

        for (let i = 0; i < subscribers.length; i += batchSize) {
            batches.push(subscribers.slice(i, i + batchSize));
        }

        logDebug(logTags.Newsletter, `Created ${batches.length} batches.`);
        return batches;
    }

    /**
     * Send emails in batches with appropriate delay.
     *
     * @returns {Promise<number>} Total emails sent.
     */
    async #processBatches(mailConfig, batches, chunkSize, tierIds, delayBetweenBatches) {
        let emailsSent = 0;
        const totalBatchLength = batches.length;
        const transporter = await this.#transporter(mailConfig);

        for (let batchIndex = 0; batchIndex < totalBatchLength; batchIndex++) {
            const batch = batches[batchIndex];
            const startIndex = batchIndex * chunkSize;

            const promises = [
                ...batch.map((subscriber, index) => {
                    const globalIndex = startIndex + index;
                    const contentToSend = this.post.isPaid ?
                        subscriber.isPaying(tierIds) ?
                            this.fullContent :
                            this.partialContent ?? this.fullContent
                        : this.fullContent;
                    return this.#sendEmailToSubscriber(transporter, mailConfig, subscriber, globalIndex, contentToSend);
                })
            ];

            const batchResults = await Promise.allSettled(promises);
            emailsSent += batchResults.filter(result => result.value === true).length;

            if (totalBatchLength > 1) {
                logToConsole(logTags.Newsletter, `Batch ${batchIndex + 1}/${totalBatchLength} complete.`);
            }

            if (batchIndex < batches.length - 1) await Miscellaneous.sleep(delayBetweenBatches);
        }

        return emailsSent;
    }
}
