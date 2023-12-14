import Miscellaneous from '../misc.js';
import * as nodemailer from 'nodemailer';
import ProjectConfigs from '../data/configs.js';
import {logDebug, logError, logTags} from '../log/logger.js';

/**
 * Class responsible for sending newsletters to subscribers.
 */
export default class NewsletterMailer {

    /**
     * Sends the newsletter to a list of subscribers.
     *
     * @param {Post} post - The post to be sent.
     * @param {Subscriber[]} subscribers - An array of subscribers.
     * @param {string} html - The HTML content of the email.
     */
    async send(post, subscribers, html) {
        post.stats.members = subscribers.length;
        post.stats.newsletterStatus = 'Sending';
        await post.update();

        logDebug(logTags.Newsletter, 'Initializing sending emails.');

        let allEmailSendPromises = [];
        const mailConfigs = await ProjectConfigs.mail();

        if (mailConfigs.length > 1 && subscribers.length > 1) {
            logDebug(logTags.Newsletter, 'More than one subscriber & email configs found, splitting the subscribers.');

            const chunkSize = Math.ceil(subscribers.length / mailConfigs.length);
            for (let i = 0; i < mailConfigs.length; i++) {
                const chunk = subscribers.slice(i * chunkSize, (i + 1) * chunkSize);
                const transporter = await this.#transporter(mailConfigs[i]);

                // Create promises for each subscriber in the chunk and add to allEmailSendPromises
                const promises = chunk.map((subscriber, index) => {
                        const globalIndex = i * chunkSize + index;
                        this.#sendEmailToSubscriber(transporter, mailConfigs[i], subscriber, globalIndex, post, html);
                    }
                );
                allEmailSendPromises.push(...promises);
            }
        } else {
            logDebug(logTags.Newsletter, 'Single user or email config found, sending email(s).');

            // Handling a single mail configuration
            const transporter = await this.#transporter(mailConfigs[0]);
            const promises = subscribers.map((subscriber, index) =>
                this.#sendEmailToSubscriber(transporter, mailConfigs[0], subscriber, index, post, html)
            );

            allEmailSendPromises.push(...promises);
        }

        // Wait for all email sending operations to complete
        const results = await Promise.allSettled(allEmailSendPromises);
        const successfulEmails = results.filter(result => result).length;

        // Update the post status and save it
        post.stats.newsletterStatus = 'Sent';
        post.stats.emailsSent = successfulEmails;
        post.stats.emailsOpened = `${successfulEmails}`.repeat(post.stats.emailsSent);
        await post.update();

        logDebug(logTags.Newsletter, 'Email sending complete.');
    }

    /**
     * Sends an email to a single subscriber.
     *
     * @param {*} transporter - The nodemailer transporter.
     * @param {Object} mailConfigs - Configs for the email.
     * @param {Subscriber} subscriber - The subscriber to send the email to.
     * @param {number} index - The index of the subscriber in the subscribers array.
     * @param {Post} post - The post related to the newsletter.
     * @param {string} html - The original HTML content of the email.
     *
     * @returns {Promise<boolean>} - Promise resolving to true if email was sent successfully, false otherwise.
     */
    async #sendEmailToSubscriber(transporter, mailConfigs, subscriber, index, post, html) {
        const correctHTML = this.#correctHTML(html, subscriber, post, index);

        try {
            const info = await transporter.sendMail({
                from: mailConfigs.from,
                replyTo: mailConfigs.reply_to,
                to: `"${subscriber.name}" <${subscriber.email}>`,
                subject: post.title,
                html: correctHTML
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
     * @returns {string} - The HTML content with placeholders replaced.
     */
    #correctHTML(html, subscriber, post, index) {
        let source = html
            .replace('{MEMBER_UUID}', subscriber.uuid)
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
}