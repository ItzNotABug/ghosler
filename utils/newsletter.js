import ejs from 'ejs';
import path from 'path';
import {fileURLToPath} from 'url';

import Ghost from './api/ghost.js';
import ProjectConfigs from './data/configs.js';
import NewsletterMailer from './mail/mailer.js';
import {logDebug, logError, logTags} from './log/logger.js';

export default class Newsletter {

    /**
     * Send email to members of the site.
     *
     * @param {Post} post
     */
    static async send(post) {
        const ghost = new Ghost();
        const site = await ghost.site();
        const subscribers = await ghost.members();
        const hasCommentsEnabled = await ghost.hasCommentsEnabled();

        if (subscribers.length === 0) {
            logDebug(logTags.Newsletter, 'Site has no registered or subscribed users, cancelling sending emails!');
            return;
        } else {
            logDebug(logTags.Newsletter, `${subscribers.length} users have enabled receiving newsletters.`);
        }

        const renderData = await this.makeRenderingData(post, site, hasCommentsEnabled);
        const template = await this.#renderTemplate(renderData);

        // save the counts for this post.
        post.stats.members = subscribers.length;
        post.stats.emailsOpened = '0'.repeat(post.stats.members);
        await post.update();

        await new NewsletterMailer().send(post, subscribers, template);
    }

    /**
     * Make the rendering data in the required format.
     *
     * @param {Post} post
     * @param {Object} site
     * @param {boolean} hasCommentsEnabled
     */
    static async makeRenderingData(post, site, hasCommentsEnabled) {
        const ghosler = await ProjectConfigs.ghosler();

        let postData = {
            site: {
                lang: site.lang,
                logo: site.logo,
                title: site.title,
                description: site.description
            },
            post: {
                url: post.url,
                date: post.date,
                title: post.title,
                author: post.primaryAuthor,
                preview: post.excerpt,
                content: post.content,
                comments: `${post.url}#ghost-comments`,
                featuredImage: post.featureImage,
                featuredImageCaption: post.featureImageCaption,
            },
            resources: {
                url: ghosler.url
            },
            newsletter: {
                trackingPixel: `${ghosler.url}/track/pixel.png?uuid={TRACKING_PIXEL_LINK}`,
                unsubscribeLink: `${site.url}unsubscribe?uuid={MEMBER_UUID}`
            },
        };

        const customisations = await ProjectConfigs.newsletter();
        postData.show_comments = customisations.show_comments && hasCommentsEnabled;
        postData.show_featured_image = customisations.show_featured_image;
        postData.show_powered_by_ghost = customisations.show_powered_by_ghost;
        postData.show_powered_by_ghosler = customisations.show_powered_by_ghosler;

        if (customisations.footer_content !== '') {
            postData.footer_content = customisations.footer_content;
        }

        return postData;
    }

    // Render the ejs template with given data.
    static async #renderTemplate(renderingData) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const templatePath = path.join(__dirname, '../views/newsletter.ejs');

        try {
            return await ejs.renderFile(templatePath, renderingData);
        } catch (error) {
            logError(logTags.Newsletter, error);
            return undefined;
        }
    }

    // Sample data for preview.
    static async preview() {
        const ghosler = await ProjectConfigs.ghosler();

        let preview = {
            site: {
                lang: 'en',
                logo: 'https://bulletin.ghost.io/content/images/size/w256h256/2021/06/ghost-orb-black-transparent-10--1-.png',
                title: 'Bulletin',
                description: 'Thoughts, stories and ideas.'
            },
            post: {
                url: 'https://bulletin.ghost.io/welcome',
                date: '22 June 2021',
                title: 'Welcome',
                author: 'Ghost',
                preview: 'We\'ve crammed the most important information to help you get started with Ghost into this one post. It\'s your cheat-sheet to get started, and your shortcut to advanced features.',
                content: '<div><p><strong>Hey there</strong>, welcome to your new home on the web! </p><p>Unlike social networks, this one is all yours. Publish your work on a custom domain, invite your audience to subscribe, send them new content by email newsletter, and offer premium subscriptions to generate sustainable recurring revenue to fund your work. </p><p>Ghost is an independent, open source app, which means you can customize absolutely everything. Inside the admin area, you\'ll find straightforward controls for changing themes, colors, navigation, logos and settings — so you can set your site up just how you like it. No technical knowledge required.</p><p>If you\'re feeling a little more adventurous, there\'s really no limit to what\'s possible. With just a little bit of HTML and CSS you can modify or build your very own theme from scratch, or connect to Zapier to explore advanced integrations. Advanced developers can go even further and build entirely custom workflows using the Ghost API.</p><p>This level of customization means that Ghost grows with you. It\'s easy to get started, but there\'s always another level of what\'s possible. So, you won\'t find yourself outgrowing the app in a few months time and wishing you\'d chosen something more powerful!</p><hr><p>For now, you\'re probably just wondering what to do first. To help get you going as quickly as possible, we\'ve populated your site with starter content (like this post!) covering all the key concepts and features of the product.</p><p>You\'ll find an outline of all the different topics below, with links to each section so you can explore the parts that interest you most.</p><p>Once you\'re ready to begin publishing and want to clear out these starter posts, you can delete the "Ghost" staff user. Deleting an author will automatically remove all of their posts, leaving you with a clean blank canvas.</p></div>',
                comments: 'https://bulletin.ghost.io/welcome/#ghost-comments',
                featuredImage: 'https://static.ghost.org/v4.0.0/images/publication-cover.jpg',
                featuredImageCaption: ''
            },
            resources: {
                url: ghosler.url
            },
            newsletter: {
                unsubscribe_link: 'https://bulletin.ghost.io/unsubscribe'
            }
        };

        const customisations = await ProjectConfigs.newsletter();
        preview.show_comments = customisations.show_comments;
        preview.show_featured_image = customisations.show_featured_image;
        preview.logo_rounded_corners = customisations.logo_rounded_corners;
        preview.show_powered_by_ghost = customisations.show_powered_by_ghost;
        preview.show_powered_by_ghosler = customisations.show_powered_by_ghosler;

        if (customisations.footer_content !== '') {
            preview.footer_content = customisations.footer_content;
        }

        return preview;
    }
}