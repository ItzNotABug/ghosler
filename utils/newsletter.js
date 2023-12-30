import he from 'he';
import ejs from 'ejs';
import path from 'path';
import * as cheerio from 'cheerio';

import Widgets from './widgets.js';
import Ghost from './api/ghost.js';
import Files from './data/files.js';
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

        const fullRenderData = await this.#makeRenderingData(post, ghost);
        const {trackedLinks, modifiedHtml: fullTemplate} = await this.renderTemplate(fullRenderData);

        let payWalledTemplate;
        if (post.isPaid) {
            const partialRenderData = this.#removePaidContent(fullRenderData);
            payWalledTemplate = (await this.renderTemplate(partialRenderData)).modifiedHtml;
        }

        if (trackedLinks.length > 0) {
            trackedLinks.forEach(link => {
                post.stats.postContentTrackedLinks.push({[link]: 0});
            });
        }

        await new NewsletterMailer().send(
            post, subscribers,
            fullTemplate, payWalledTemplate,
            fullRenderData.newsletter.unsubscribeLink
        );
    }

    /**
     * Make the rendering data in the required format.
     *
     * @param {Post} post
     * @param {Ghost} ghost
     */
    static async #makeRenderingData(post, ghost) {
        const ghosler = await ProjectConfigs.ghosler();

        const site = await ghost.site();
        const hasCommentsEnabled = await ghost.hasCommentsEnabled();

        let postData = {
            site: {
                url: site.url,
                lang: site.lang,
                logo: site.logo,
                title: site.title,
                description: site.description,
                color: site.accent_color ?? '#ff247c',
            },
            post: {
                id: post.id,
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
                unsubscribeLink: `${site.url}unsubscribe?uuid={MEMBER_UUID}`,
                feedbackLikeLink: `${site.url}#/feedback/${post.id}/1/?uuid={MEMBER_UUID}`,
                feedbackDislikeLink: `${site.url}#/feedback/${post.id}/0/?uuid={MEMBER_UUID}`
            },
        };

        const customisations = await ProjectConfigs.newsletter();
        postData.center_title = customisations.center_title;
        postData.show_feedback = customisations.show_feedback;
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
                preview: (
                    post.custom_excerpt ??
                    post.excerpt ?? 'Click to read & discover more in the full article.'
                ).replace(/\n/g, '. ')
            }));
        }

        postData.trackLinks = customisations.track_links;

        return postData;
    }

    /**
     * Render the newsletter `ejs` template with given data.
     *
     * @param renderingData Data to use to render the content.
     * @returns {Promise<{trackedLinks: string[], modifiedHtml: string}|undefined>}
     */
    static async renderTemplate(renderingData) {
        let templatePath;
        const injectUrlTracking = renderingData.trackLinks;

        if (await Files.customTemplateExists()) {
            templatePath = Files.customTemplatePath();
        } else templatePath = path.join(process.cwd(), '/views/newsletter.ejs');

        try {
            const template = await ejs.renderFile(templatePath, renderingData);
            const injectedHtml = injectUrlTracking
                ? await this.#injectUrlTracking(renderingData, template)
                : {trackedLinks: new Set(), modifiedHtml: template};

            // add widgets, inline css and minify the html.
            return await Widgets.replace(renderingData, injectedHtml);
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

    /**
     * @returns {Promise<{trackedLinks: Set<string>, modifiedHtml: string}>}
     */
    static async #injectUrlTracking(renderingData, renderedPostData) {
        const ghosler = await ProjectConfigs.ghosler();
        const pingUrl = `${ghosler.url}/track/link?postId=${renderingData.post.id}&redirect=`;

        const domainsToExclude = [
            new URL('https://static.ghost.org').host,
            ghosler.url && (
                ghosler.url.startsWith('http://') || ghosler.url.startsWith('https://')
            ) ? new URL(ghosler.url).host : null,
        ].filter(Boolean);

        let urlsToExclude = [];

        // a post may not have a featured image.
        if (renderingData.post.featuredImage) {
            urlsToExclude.push(he.decode(renderingData.post.featuredImage));
        }

        // a post may also not have a caption.
        if (renderingData.post.featuredImageCaption) {
            const $caption = cheerio.load(renderingData.post.featuredImageCaption);
            $caption('a').each((_, elem) => {
                urlsToExclude.push(he.decode($caption(elem).attr('href')));
            });
        }

        /**
         * Exclude certain urls like -
         * 1. blog & its logo url,
         * 2. current post url, comments,
         * 3. subscription, unsubscribe,
         * 4. featured image urls from keep reading section (if exists).
         *
         * This way we can be sure to track links to other articles as well, example: Keep Reading section.
         */
        [
            renderingData.site.url, renderingData.site.logo,
            renderingData.post.url, renderingData.post.comments,
            renderingData.newsletter.subscription,
            renderingData.newsletter.unsubscribeLink,
            renderingData.newsletter.feedbackLikeLink,
            renderingData.newsletter.feedbackDislikeLink,
            // featuredImage can be null, so we should to filter them.
            ...renderingData.post.latestPosts.filter(post => post.featuredImage).map(post => post.featuredImage)
        ].forEach(internalLinks => urlsToExclude.push(he.decode(internalLinks)));

        const trackedLinks = new Set();
        const $ = cheerio.load(renderedPostData);

        // these elements are added as a part of a main element.
        // example: the bookmark can include a favicon and an img tag.
        const elementsToExclude = ['.kg-bookmark-icon', '.kg-bookmark-thumbnail', '.kg-file-card-container'];

        // we don't need to worry about the urls in
        // audio & video cards as we only target the anchor and image tags.
        $('a[href], img[src], iframe[src]').each((_, element) => {
            const isExcluded = elementsToExclude.some(cls => $(element).closest(cls).length > 0);
            if (isExcluded) return;

            const tag = $(element).is('a') ? 'href' : 'src';
            let elementUrl = $(element).attr(tag);
            if (elementUrl === '#' || !elementUrl) return;

            elementUrl = he.decode(elementUrl);
            const urlHost = new URL(elementUrl).host;

            if (!domainsToExclude.includes(urlHost) && !urlsToExclude.includes(elementUrl)) {
                trackedLinks.add(elementUrl);
                $(element).attr(tag, `${pingUrl}${elementUrl}`);
            }
        });

        // Convert the set to an array and return along with modified HTML
        return {trackedLinks: trackedLinks, modifiedHtml: $.html()};
    }

    // Sample data for preview.
    static async preview() {
        let preview = {
            site: {
                lang: 'en',
                color: '#ff247c',
                url: 'https://bulletin.ghost.io/',
                logo: 'https://bulletin.ghost.io/content/images/size/w256h256/2021/06/ghost-orb-black-transparent-10--1-.png',
                title: 'Bulletin',
                description: 'Thoughts, stories and ideas.'
            },
            post: {
                id: '60d14faa9e72bc002f16c727',
                url: 'https://bulletin.ghost.io/welcome',
                date: '22 June 2021',
                title: 'Welcome',
                author: 'Ghost',
                preview: 'We\'ve crammed the most important information to help you get started with Ghost into this one post. It\'s your cheat-sheet to get started, and your shortcut to advanced features.',
                content: '<div><p><strong>Hey there</strong>, welcome to your new home on the web!</p><hr><h3>Ghost</h3><p>Ghost is an independent, open source app, which means you can customize absolutely everything. Inside the admin area, you\'ll find straightforward controls for changing themes, colors, navigation, logos and settings — so you can set your site up just how you like it. No technical knowledge required.</p><hr><h3>Ghosler</h3><p>Ghosler is an open source project designed for those starting with Ghost or managing a small to moderate user base. It provides extensive control over newsletter settings and customization, enhancing your outreach with features like URL Click Tracking, Newsletter Feedback, Email Deliverability, and Email Open Rate Analytics. Additionally, Ghosler handles both Free & Paid members content management efficiently.</p><p>Moreover, Ghosler supports popular Ghost widgets, including Images/Unsplash, Audio, Video, File, Toggle, Callout Card, and social media integrations like Twitter (X), YouTube, Vimeo, along with Button, Bookmark, and Blockquote features.</p><hr><h3>Ending the Preview</h3><p>Once you\'re ready to begin publishing and want to clear out these starter posts, you can delete the Ghost staff user. Deleting an author will automatically remove all of their posts, leaving you with a clean blank canvas.</p></div>',
                comments: 'https://bulletin.ghost.io/welcome/#ghost-comments',
                featuredImage: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2874&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                featuredImageCaption: '<span style="white-space: pre-wrap;">Photo by </span><a href="https://unsplash.com/@fakurian?utm_source=ghost&amp;utm_medium=referral&amp;utm_campaign=api-credit" style="color: #ff247c; text-decoration: none; overflow-wrap: anywhere;"><span style="white-space: pre-wrap;">Milad Fakurian</span></a><span style="white-space: pre-wrap;"> / </span><a href="https://unsplash.com/?utm_source=ghost&amp;utm_medium=referral&amp;utm_campaign=api-credit" style="color: #ff247c; text-decoration: none; overflow-wrap: anywhere;"><span style="white-space: pre-wrap;">Unsplash</span></a>',
                latestPosts: [],
                showPaywall: true
            },
            newsletter: {
                unsubscribeLink: 'https://bulletin.ghost.io/unsubscribe',
                subscription: 'https://bulletin.ghost.io/#/portal/account',
                feedbackLikeLink: 'https://bulletin.ghost.io/#/feedback/60d14faa9e72bc002f16c727/1/?uuid=example',
                feedbackDislikeLink: 'https://bulletin.ghost.io/#/feedback/60d14faa9e72bc002f16c727/0/?uuid=example'
            }
        };

        const customisations = await ProjectConfigs.newsletter();
        preview.center_title = customisations.center_title;
        preview.show_feedback = customisations.show_feedback;
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

        preview.trackLinks = customisations.track_links;

        return preview;
    }
}