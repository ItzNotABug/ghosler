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
        const subscribers = await ghost.members();

        if (subscribers.length === 0) {
            logDebug(logTags.Newsletter, 'Site has no registered or subscribed users, cancelling sending emails!');
            return;
        } else {
            logDebug(logTags.Newsletter, `${subscribers.length} users have enabled receiving newsletters.`);
        }

        const fullRenderData = await this.makeRenderingData(post, ghost);
        const fullyRenderedTemplate = await this.#renderTemplate(fullRenderData);

        let payWalledTemplate;
        if (post.isPaid) {
            const partialRenderData = this.#removePaidContent(fullRenderData);
            payWalledTemplate = await this.#renderTemplate(partialRenderData);
        }

        await new NewsletterMailer().send(
            post, subscribers,
            fullyRenderedTemplate, payWalledTemplate,
            fullRenderData.newsletter.unsubscribeLink
        );
    }

    /**
     * Make the rendering data in the required format.
     *
     * @param {Post} post
     * @param {Ghost} ghost
     */
    static async makeRenderingData(post, ghost) {
        const ghosler = await ProjectConfigs.ghosler();

        const site = await ghost.site();
        const hasCommentsEnabled = await ghost.hasCommentsEnabled();

        let postData = {
            site: {
                lang: site.lang,
                logo: site.logo,
                title: site.title,
                description: site.description,
                color: site.accent_color ?? '#ff247c',
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
                latestPosts: [],
                showPaywall: false
            },
            newsletter: {
                subscription: `${site.url}#/portal/account`,
                trackingPixel: `${ghosler.url}/track/pixel.png?uuid={TRACKING_PIXEL_LINK}`,
                unsubscribeLink: `${site.url}unsubscribe?uuid={MEMBER_UUID}`
            },
        };

        const customisations = await ProjectConfigs.newsletter();
        postData.center_title = customisations.center_title;
        postData.show_subscription = customisations.show_subscription;
        postData.show_featured_image = customisations.show_featured_image;
        postData.show_powered_by_ghost = customisations.show_powered_by_ghost;
        postData.show_powered_by_ghosler = customisations.show_powered_by_ghosler;
        postData.show_comments = customisations.show_comments && hasCommentsEnabled;

        if (customisations.footer_content !== '') {
            postData.footer_content = customisations.footer_content;
        }

        if (customisations.show_latest_posts) {
            const latestPosts = await ghost.latest(post.id);
            postData.post.latestPosts = latestPosts.map(post => ({
                title: post.title,
                url: post.url,
                featuredImage: post.feature_image,
                preview: (post.custom_excerpt ?? post.excerpt).replace(/\n/g, '. ')
            }));
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

    // remove content that is paid.
    static #removePaidContent(renderedPostData) {
        let postContent = renderedPostData.post.content;

        const segmentIndex = postContent.indexOf('<!--members-only-->');
        if (segmentIndex !== -1) {
            renderedPostData.post.showPaywall = true;
            renderedPostData.post.content = postContent.substring(0, segmentIndex);
        }

        return renderedPostData;
    }

    // Sample data for preview.
    static async preview() {
        let preview = {
            site: {
                lang: 'en',
                color: '#ff247c',
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
                content: '<div><p><strong>Hey there</strong>, welcome to your new home on the web! </p><p>Unlike social networks, this one is all yours. Publish your work on a custom domain, invite your audience to subscribe, send them new content by email newsletter, and offer premium subscriptions to generate sustainable recurring revenue to fund your work. </p><p>Ghost is an independent, open source app, which means you can customize absolutely everything. Inside the admin area, you\'ll find straightforward controls for changing themes, colors, navigation, logos and settings — so you can set your site up just how you like it. No technical knowledge required.</p><p>If you\'re feeling a little more adventurous, there\'s really no limit to what\'s possible. With just a little bit of HTML and CSS you can modify or build your very own theme from scratch, or connect to Zapier to explore advanced integrations. Advanced developers can go even further and build entirely custom workflows using the Ghost API.</p><p>This level of customization means that Ghost grows with you. It\'s easy to get started, but there\'s always another level of what\'s possible. So, you won\'t find yourself outgrowing the app in a few months time and wishing you\'d chosen something more powerful!</p><hr><p>For now, you\'re probably just wondering what to do first. To help get you going as quickly as possible, we\'ve populated your site with starter content (like this post!) covering all the key concepts and features of the product.</p><p><blockquote>You\'ll find an outline of all the different topics below, with links to each section, so you can explore the parts that interest you most.</blockquote></p><p>Once you\'re ready to begin publishing and want to clear out these starter posts, you can delete the <code>"Ghost"</code> staff user. Deleting an author will automatically remove all of their posts, leaving you with a clean blank canvas.</p></div>',
                comments: 'https://bulletin.ghost.io/welcome/#ghost-comments',
                featuredImage: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2874&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                featuredImageCaption: '<span style="white-space: pre-wrap;">Photo by </span><a href="https://unsplash.com/@fakurian?utm_source=ghost&amp;utm_medium=referral&amp;utm_campaign=api-credit" style="color: #2fb1ff; text-decoration: none; overflow-wrap: anywhere;"><span style="white-space: pre-wrap;">Milad Fakurian</span></a><span style="white-space: pre-wrap;"> / </span><a href="https://unsplash.com/?utm_source=ghost&amp;utm_medium=referral&amp;utm_campaign=api-credit" style="color: #2fb1ff; text-decoration: none; overflow-wrap: anywhere;"><span style="white-space: pre-wrap;">Unsplash</span></a>',
                latestPosts: [],
                showPaywall: true
            },
            newsletter: {
                unsubscribeLink: 'https://bulletin.ghost.io/unsubscribe',
                subscription: 'https://bulletin.ghost.io/#/portal/account',
            }
        };

        const customisations = await ProjectConfigs.newsletter();
        preview.center_title = customisations.center_title;
        preview.show_comments = customisations.show_comments;
        preview.show_subscription = customisations.show_subscription;

        preview.show_featured_image = customisations.show_featured_image;
        preview.show_powered_by_ghost = customisations.show_powered_by_ghost;
        preview.show_powered_by_ghosler = customisations.show_powered_by_ghosler;

        if (customisations.show_latest_posts) {
            preview.post.latestPosts = [
                {
                    title: '5 ways to repurpose content like a professional creator',
                    url: 'https://bulletin.ghost.io/5-ways-to-repurpose-content-like-a-professional-creator/',
                    preview: 'Ever wonder how the biggest creators publish so much content on such a consistent schedule? It\'s not magic, but once you understand how this tactic works, it\'ll feel like it is.',
                    featuredImage: 'https://images.unsplash.com/photo-1609761973820-17fe079a78dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxMTc3M3wwfDF8c2VhcmNofDkzfHx3b3JraW5nfGVufDB8fHx8MTYyNTQ3Mzg2NA&ixlib=rb-1.2.1&q=80&w=2000'
                },
                {
                    title: 'Customizing your brand and design settings',
                    url: 'https://bulletin.ghost.io/design/',
                    preview: 'How to tweak a few settings in Ghost to transform your site from a generic template to a custom brand with style and personality.',
                    featuredImage: 'https://static.ghost.org/v4.0.0/images/publishing-options.png'
                }
            ];
        }

        if (customisations.footer_content !== '') {
            preview.footer_content = customisations.footer_content;
        }

        return preview;
    }
}