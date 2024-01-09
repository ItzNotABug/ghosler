import Miscellaneous from '../misc.js';
import * as nodemailer from 'nodemailer';
import ProjectConfigs from '../data/configs.js';
import {logDebug, logError, logTags, logToConsole} from '../log/logger.js';

/**
 * Class responsible for sending newsletters to subscribers.
 */
export default class NewsletterMailer {

    /**
     * Sends the newsletter to a list of subscribers.
     *
     * @param {Post} post - The post to be sent.
     * @param {Subscriber[]} subscribers - An array of subscribers.
     * @param {string} fullContent - The HTML content of the email.
     * @param {string|undefined} partialContent - Partial HTML content of the email for non-paying users.
     * @param {string} unsubscribeLink - An unsubscribe link for the subscribers.
     */
    async send(post, subscribers, fullContent, partialContent, unsubscribeLink) {
        post.stats.members = subscribers.length;
        post.stats.newsletterStatus = 'Sending';
        await post.update();

        logDebug(logTags.Newsletter, 'Initializing sending emails.');

        let totalEmailsSent = 0;
        const mailConfigs = await ProjectConfigs.mail();
        let tierIds = post.isPaid ? [...post.tiers.map(tier => tier.id)] : [];

        if (mailConfigs.length > 1 && subscribers.length > 1) {
            logDebug(logTags.Newsletter, 'More than one subscriber & email configs found, splitting the subscribers.');

            const chunkSize = Math.ceil(subscribers.length / mailConfigs.length);
            for (let i = 0; i < mailConfigs.length; i++) {

                // settings
                const mailConfig = mailConfigs[i];
                const emailsPerBatch = mailConfig.batch_size ?? 10;
                const delayPerBatch = mailConfig.delay_per_batch ?? 1250;
                const chunkedSubscribers = subscribers.slice(i * chunkSize, (i + 1) * chunkSize);

                // create a batch and send.
                const transporter = await this.#transporter(mailConfig);
                const batches = this.#createBatches(chunkedSubscribers, emailsPerBatch);

                // we increment this stat as we are inside a loop.
                totalEmailsSent += await this.#processBatches(transporter, mailConfig, batches, chunkSize, tierIds, post, fullContent, partialContent, unsubscribeLink, delayPerBatch);
            }
        } else {
            logDebug(logTags.Newsletter, 'Single user or email config found, sending email(s).');

            // settings
            const mailConfig = mailConfigs[0];
            const emailsPerBatch = mailConfig.batch_size ?? 10;
            const delayPerBatch = mailConfig.delay_per_batch ?? 1250;

            // create a batch and send.
            const transporter = await this.#transporter(mailConfig);
            const batches = this.#createBatches(subscribers, emailsPerBatch);
            totalEmailsSent = await this.#processBatches(transporter, mailConfig, batches, emailsPerBatch, tierIds, post, fullContent, partialContent, unsubscribeLink, delayPerBatch);
        }

        // Update post status and save it.
        post.stats.newsletterStatus = 'Sent';
        post.stats.emailsSent = totalEmailsSent;
        post.stats.emailsOpened = '0'.repeat(totalEmailsSent);
        await post.update();

        logDebug(logTags.Newsletter, 'Email sending complete.');
    }

    /**
     * Sends an email to a single subscriber.
     *
     * @param {*} transporter - The nodemailer transporter.
     * @param {Object} mailConfig - Configs for the email.
     * @param {Subscriber} subscriber - The subscriber to send the email to.
     * @param {number} index - The index of the subscriber in the subscribers array.
     * @param {Post} post - The post related to the newsletter.
     * @param {string} html - The original HTML content of the email.
     * @param {string} unsubscribeLink - An unsubscribe link for the subscriber.
     *
     * @returns {Promise<boolean>} - Promise resolving to true if email was sent successfully, false otherwise.
     */
    async #sendEmailToSubscriber(transporter, mailConfig, subscriber, index, post, html, unsubscribeLink) {
        const correctHTML = this.#correctHTML(html, subscriber, post, index);

        try {
            const info = await transporter.sendMail({
                from: mailConfig.from,
                replyTo: mailConfig.reply_to,
                to: `"${subscriber.name}" <${subscriber.email}>`,
                subject: post.title,
                html: correctHTML,
                list: {
                    unsubscribe: {
                        comment: 'Unsubscribe',
                        url: unsubscribeLink.replace('{MEMBER_UUID}', subscriber.uuid),
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
     * @param {Post} post - The post related to the newsletter.
     * @param {number} index - The index of the subscriber in the subscribers array.
     *
     * @returns {string} - The HTML content with placeholders replaced.
     */
    #correctHTML(html, subscriber, post, index) {
        let source = html
            .replace(/{MEMBER_UUID}/g, subscriber.uuid)
            .replace('Jamie Larson', subscriber.name) // default value due to preview
            .replace('19 September 2013', subscriber.created) // default value due to preview
            .replace('jamie@example.com', subscriber.email) // default value due to preview
            .replace('free subscriber', `${subscriber.status} subscriber`) // default value due to preview
            .replace('{TRACKING_PIXEL_LINK}', Miscellaneous.encode(`${post.id}_${index}`));

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
     * Creates and configures a nodemailer transporter.
     *
     * @param {Object} mailConfigs - Configs for the email.
     *
     * @returns {Promise<*>} - The configured transporter.
     */
    async #transporter(mailConfigs) {
        return nodemailer.createTransport({
            secure: true,
            host: mailConfigs.host,
            port: mailConfigs.port,
            auth: {user: mailConfigs.auth.user, pass: mailConfigs.auth.pass}
        });
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
    async #processBatches(transporter, mailConfig, batches, chunkSize, tierIds, post, fullContent, partialContent, unsubscribeLink, delayBetweenBatches) {
        let emailsSent = 0;

        const totalBatchLength = batches.length;
        for (let batchIndex = 0; batchIndex < totalBatchLength; batchIndex++) {
            const batch = batches[batchIndex];
            const startIndex = batchIndex * chunkSize;

            const promises = [
                ...batch.map((subscriber, index) => {
                    const globalIndex = startIndex + index;
                    const contentToSend = post.isPaid ? subscriber.isPaying(tierIds) ? fullContent : partialContent ?? fullContent : fullContent;
                    return this.#sendEmailToSubscriber(transporter, mailConfig, subscriber, globalIndex, post, contentToSend, unsubscribeLink);
                })
            ];

            const batchResults = await Promise.allSettled(promises);
            emailsSent += batchResults.filter(result => result.value === true).length;

            logToConsole(logTags.Newsletter, `Batch ${batchIndex + 1}/${totalBatchLength} complete.`);
            if (batchIndex < batches.length - 1) await Miscellaneous.sleep(delayBetweenBatches);
        }

        return emailsSent;
    }
}