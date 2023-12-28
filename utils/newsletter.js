import he from 'he';
import ejs from 'ejs';
import path from 'path';
import {inline} from "css-inline";
import * as cheerio from 'cheerio';
import {minify} from 'html-minifier';

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
        const postUrl = renderingData.post.url;
        const injectUrlTracking = renderingData.trackLinks;

        if (await Files.customTemplateExists()) {
            templatePath = Files.customTemplatePath();
        } else templatePath = path.join(process.cwd(), '/views/newsletter.ejs');

        try {
            const template = await ejs.renderFile(templatePath, renderingData);
            const injectedHtml = injectUrlTracking
                ? await this.#injectUrlTracking(renderingData, template)
                : {trackedLinks: [], modifiedHtml: template};

            return {
                trackedLinks: injectedHtml.trackedLinks,
                modifiedHtml: this.#replaceAndMinify(injectedHtml.modifiedHtml, postUrl)
            };
        } catch (error) {
            logError(logTags.Newsletter, error);
            return undefined;
        }
    }

    /**
     * Replaces a few classes for ui fixes, & minifies the html.
     *
     * @param {string} template - The html template to modify further.
     * @param {string} postUrl - The url of the post for redirection is template contains video.
     * @returns {string} The final, minified html to use for email and preview.
     */
    static #replaceAndMinify(template, postUrl) {
        const widgetsContainingHtml = Widgets.replace(template, postUrl);
        const inlinedCssHtml = inline(widgetsContainingHtml, {
            keep_style_tags: true,
            inline_style_tags: true,
        });

        // Minify the HTML content
        return minify(inlinedCssHtml, {
            minifyCSS: true,
            removeComments: true,
            collapseWhitespace: true,
            removeAttributeQuotes: true,
        });
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
     * @return {Promise<{trackedLinks: any[], modifiedHtml: string}>}
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
        $('a[href], img[src]').each((_, element) => {
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
        return {trackedLinks: Array.from(trackedLinks), modifiedHtml: $.html()};
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
                content: '<div><p><strong>Hey there</strong>, welcome to your new home on the web!</p><hr><h3>Ghost</h3><p>Ghost is an independent, open source app, which means you can customize absolutely everything. Inside the admin area, you\'ll find straightforward controls for changing themes, colors, navigation, logos and settings — so you can set your site up just how you like it. No technical knowledge required.</p><hr><h3>Ghosler</h3><p>Ghosler is an open source project that enables you to start your newsletter when you are just starting with Ghost or have a small to moderate user base. You get full control over the settings and the customization for the newsletter with so many other features.<br><br><strong>Features:</strong><li><i>URL Click Tracking</i></li><li><i>Newsletter feedback</i></li><li><i>Email deliverability</i></li><li><i>Email open rate analytics</i></li><li><i>Free & Paid members content management</i></li></p><p>Ghosler also supports some of the most used widgets (cards) on Ghost.</p><hr><p>Here\'s an example of a Blockquote -</p><blockquote>You\'ll find an outline of all the different topics below, with links to each section, so you can explore the parts that interest you most.</blockquote><p>Here\'s an example of a Bookmark -</p><figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://ghost.org/resources/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Ghost Resources — Stories &amp; Ideas About Indie Publishing</div><div class="kg-bookmark-description">A library of resources to help you share content, grow your audience, and build an independent subscription business in the creator economy.</div><div class="kg-bookmark-metadata"><img alt="" class="kg-bookmark-icon" src="https://ghost.org/resources/content/images/size/w256h256/2021/10/ghost-orb-pink-transparent-01-1.png"><span class="kg-bookmark-author">Ghost Resources</span></div></div><div class="kg-bookmark-thumbnail"><img alt src="https://ghost.org/resources/content/images/size/w1200/2021/10/ghost-resources-2.png"></div></a><figcaption><p dir="ltr"><span style="white-space:pre-wrap">Bookmark Caption</span></p></figcaption></figure><p>Here\'s an example of a left aligned Button -</p><div class="kg-card kg-button-card kg-align-left"><a class="kg-btn kg-btn-accent" href="https://ghost.org/">Ghost Button</a></div><br><p>Here\'s an example of a Toggle Card,<br>these are not collapsible or expandable on emails -<div class="kg-card kg-toggle-card"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text"><span style="white-space:pre-wrap">Toggleable Header</span></h4></div><div class="kg-toggle-content"><p dir="ltr"><span style="white-space:pre-wrap">Collapsible Content that probably contains a lot and a lot of lorem ipsum stuff maybe...</span></p></div></div><p>Here\'s an example of a Callout card<br>Supports all colors (gray, white, blue, green yellow, red, pink, purple, accent (site-color) mentioned on Ghost Editor) -</p><div class="kg-card kg-callout-card kg-callout-card-blue"><div class="kg-callout-emoji">🫶</div><div class="kg-callout-text">Things will work out!</div></div><p>Here\'s an example of a Pre tag with<code><strong>Code</strong></code>inside -</p><pre><code>TypeError: Cannot read property \'bold\' of null\nat makeBold (Koenig.js:16:25)\nat scanContent (Koenig.js:25:10)\nat main (Koenig.js:14:5)</code></pre><br><p>Here\'s an example of an Video Card -<figure class="kg-card kg-video-card kg-width-regular" data-kg-custom-thumbnail="" data-kg-thumbnail="https://ghost.org/images/home/dashboard.webp"><div class="kg-video-container"><video height="720" playsinline="" poster="https://img.spacergif.org/v1/1280x720/0a/spacer.png" preload="metadata" src="https://ghost.org/videos/dashboard.mp4" style="background:transparent url(https://ghost.org/images/home/dashboard.webp) 50% 50%/cover no-repeat" width="1280"></video><div class="kg-video-overlay"><button aria-label="Play video" class="kg-video-large-play-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.14 10.608 2.253.164A1.559 1.559 0 0 0 0 1.557v20.887a1.558 1.558 0 0 0 2.253 1.392L23.14 13.393a1.557 1.557 0 0 0 0-2.785Z"></path></svg></button></div><div class="kg-video-player-container"><div class="kg-video-player"><button aria-label="Play video" class="kg-video-play-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.14 10.608 2.253.164A1.559 1.559 0 0 0 0 1.557v20.887a1.558 1.558 0 0 0 2.253 1.392L23.14 13.393a1.557 1.557 0 0 0 0-2.785Z"></path></svg></button><button aria-label="Pause video" class="kg-video-pause-icon kg-video-hide"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect height="22" rx="1.5" ry="1.5" width="7" x="3" y="1"></rect><rect height="22" rx="1.5" ry="1.5" width="7" x="14" y="1"></rect></svg></button><span class="kg-video-current-time">0:00</span><div class="kg-video-time">/<span class="kg-video-duration">0:05</span></div><input class="kg-video-seek-slider" max="100" type="range" value="0"><button aria-label="Adjust playback speed" class="kg-video-playback-rate">1×</button><button aria-label="Unmute" class="kg-video-unmute-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.189 2.021a9.728 9.728 0 0 0-7.924 4.85.249.249 0 0 1-.221.133H5.25a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1.794a.249.249 0 0 1 .221.133 9.73 9.73 0 0 0 7.924 4.85h.06a1 1 0 0 0 1-1V3.02a1 1 0 0 0-1.06-.998Z"></path></svg></button><button aria-label="Mute" class="kg-video-mute-icon kg-video-hide"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.177 4.3a.248.248 0 0 0 .073-.176v-1.1a1 1 0 0 0-1.061-1 9.728 9.728 0 0 0-7.924 4.85.249.249 0 0 1-.221.133H5.25a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h.114a.251.251 0 0 0 .177-.073ZM23.707 1.706A1 1 0 0 0 22.293.292l-22 22a1 1 0 0 0 0 1.414l.009.009a1 1 0 0 0 1.405-.009l6.63-6.631A.251.251 0 0 1 8.515 17a.245.245 0 0 1 .177.075 10.081 10.081 0 0 0 6.5 2.92 1 1 0 0 0 1.061-1V9.266a.247.247 0 0 1.073-.176Z"></path></svg></button><input class="kg-video-volume-slider" max="100" type="range" value="100"></div></div></div></figure><br><p>Here\'s an example of an Audio Card -<div class="kg-card kg-audio-card"><img src="" alt="audio-thumbnail" class="kg-audio-thumbnail kg-audio-hide"><div class="kg-audio-thumbnail placeholder"><svg width="24" height="24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.5 15.33a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM15 13.83a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M14.486 6.81A2.25 2.25 0 0 1 17.25 9v5.579a.75.75 0 0 1-1.5 0v-5.58a.75.75 0 0 0-.932-.727.755.755 0 0 1-.059.013l-4.465.744a.75.75 0 0 0-.544.72v6.33a.75.75 0 0 1-1.5 0v-6.33a2.25 2.25 0 0 1 1.763-2.194l4.473-.746Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M3 1.5a.75.75 0 0 0-.75.75v19.5a.75.75 0 0 0 .75.75h18a.75.75 0 0 0 .75-.75V5.133a.75.75 0 0 0-.225-.535l-.002-.002-3-2.883A.75.75 0 0 0 18 1.5H3ZM1.409.659A2.25 2.25 0 0 1 3 0h15a2.25 2.25 0 0 1 1.568.637l.003.002 3 2.883a2.25 2.25 0 0 1 .679 1.61V21.75A2.25 2.25 0 0 1 21 24H3a2.25 2.25 0 0 1-2.25-2.25V2.25c0-.597.237-1.169.659-1.591Z"></path></svg></div><div class="kg-audio-player-container"><audio src="https://file-examples.com/wp-content/storage/2017/11/file_example_MP3_700KB.mp3" preload="metadata"></audio><div class="kg-audio-title">File example MP3 700KB</div><div class="kg-audio-player"><button class="kg-audio-play-icon" aria-label="Play audio"><svg viewBox="0 0 24 24"><path d="M23.14 10.608 2.253.164A1.559 1.559 0 0 0 0 1.557v20.887a1.558 1.558 0 0 0 2.253 1.392L23.14 13.393a1.557 1.557 0 0 0 0-2.785Z"></path></svg></button><button class="kg-audio-pause-icon kg-audio-hide" aria-label="Pause audio"><svg viewBox="0 0 24 24"><rect x="3" y="1" width="7" height="22" rx="1.5" ry="1.5"></rect><rect x="14" y="1" width="7" height="22" rx="1.5" ry="1.5"></rect></svg></button><span class="kg-audio-current-time">0:00</span><div class="kg-audio-time">/<span class="kg-audio-duration">42.057143</span></div><input type="range" class="kg-audio-seek-slider" max="100" value="0"><button class="kg-audio-playback-rate" aria-label="Adjust playback speed">1×</button><button class="kg-audio-unmute-icon" aria-label="Unmute"><svg viewBox="0 0 24 24"><path d="M15.189 2.021a9.728 9.728 0 0 0-7.924 4.85.249.249 0 0 1-.221.133H5.25a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1.794a.249.249 0 0 1 .221.133 9.73 9.73 0 0 0 7.924 4.85h.06a1 1 0 0 0 1-1V3.02a1 1 0 0 0-1.06-.998Z"></path></svg></button><button class="kg-audio-mute-icon kg-audio-hide" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M16.177 4.3a.248.248 0 0 0 .073-.176v-1.1a1 1 0 0 0-1.061-1 9.728 9.728 0 0 0-7.924 4.85.249.249 0 0 1-.221.133H5.25a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h.114a.251.251 0 0 0 .177-.073ZM23.707 1.706A1 1 0 0 0 22.293.292l-22 22a1 1 0 0 0 0 1.414l.009.009a1 1 0 0 0 1.405-.009l6.63-6.631A.251.251 0 0 1 8.515 17a.245.245 0 0 1 .177.075 10.081 10.081 0 0 0 6.5 2.92 1 1 0 0 0 1.061-1V9.266a.247.247 0 0 1 .073-.176Z"></path></svg></button><input type="range" class="kg-audio-volume-slider" max="100" value="100"></div></div></div><br><p>Here\'s an example of a File Card -<div class="kg-card kg-file-card"><a class="kg-file-card-container" href="https://github.com/ItzNotABug/ghosler/blob/master/README.md" title="Download" download=""><div class="kg-file-card-contents"><div class="kg-file-card-title">README</div><div class="kg-file-card-caption">Ghosler\'s README file on GitHub.</div><div class="kg-file-card-metadata"><div class="kg-file-card-filename">README.md</div><div class="kg-file-card-filesize">6.95 Kb</div></div></div><div class="kg-file-card-icon"><svg viewBox="0 0 24 24"><defs><style>.a{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px}</style></defs><title>download-circle</title><polyline class="a" points="8.25 14.25 12 18 15.75 14.25"></polyline><line class="a" x1="12" y1="6.75" x2="12" y2="18"></line><circle class="a" cx="12" cy="12" r="11.25"></circle></svg></div></a></div><div class="kg-card kg-file-card"><a class="kg-file-card-container" href="https://github.com/ItzNotABug/ghosler/blob/master/LICENSE.md" title="Download" download=""><div class="kg-file-card-contents"><div class="kg-file-card-title">LICENSE</div><div class="kg-file-card-caption"></div><div class="kg-file-card-metadata"><div class="kg-file-card-filename">LICENSE.md</div><div class="kg-file-card-filesize">11.1 KB</div></div></div><div class="kg-file-card-icon"><svg viewBox="0 0 24 24"><defs><style>.a{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px}</style></defs><title>download-circle</title><polyline class="a" points="8.25 14.25 12 18 15.75 14.25"></polyline><line class="a" x1="12" y1="6.75" x2="12" y2="18"></line><circle class="a" cx="12" cy="12" r="11.25"></circle></svg></div></a></div><hr><h3>Ending the Preview</h3><p>Once you\'re ready to begin publishing and want to clear out these starter posts, you can delete the Ghost staff user. Deleting an author will automatically remove all of their posts, leaving you with a clean blank canvas.</p></div>',
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