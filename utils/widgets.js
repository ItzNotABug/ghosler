// noinspection HtmlUnknownAttribute,CssOverwrittenProperties,JSJQueryEfficiency

import {inline} from 'css-inline';
import * as cheerio from 'cheerio';
import probe from 'probe-image-size';
import {minify} from 'html-minifier';

import Miscellaneous from './misc.js';

export default class Widgets {

    /**
     * Handles adding Bookmarks, Video, Audio, File, YouTube, Twitter, Image/Unsplash cards.
     *
     * @param {Object} renderingData
     * @param {{trackedLinks: Set<string>, modifiedHtml: string}} injectedHtml
     *
     * @returns {Promise<{trackedLinks: string[], modifiedHtml: string}>}
     */
    static async replace(renderingData, injectedHtml) {
        const $ = cheerio.load(injectedHtml.modifiedHtml);

        const postId = renderingData.post.id;
        const postUrl = renderingData.post.url;
        const isTracking = renderingData.trackLinks;
        let trackedLinks = new Set(injectedHtml.trackedLinks);

        this.#bookmark($);
        this.#file($, postUrl);
        this.#audio($, postUrl);
        this.#video($, postUrl);

        await this.#gallery($, trackedLinks, isTracking);

        // embedded cards
        this.#twitter_x($);
        await this.#youtubeOrVimeo($, trackedLinks, isTracking);
        await this.#unsplashOrImage($, postId, trackedLinks, isTracking);

        //trackedLinks: [], modifiedHtml: template
        return {trackedLinks: Array.from(trackedLinks), modifiedHtml: this.#inlineAndMinify($)};
    }

    /**
     * Add a bookmark card if raw format exists for it.
     *
     * @param $
     */
    static #bookmark($) {
        const bookmarkPublisher = $('.kg-bookmark-publisher');
        bookmarkPublisher.html(`<span style="margin:0 6px">•</span>${bookmarkPublisher.html()}`);

        $('.kg-bookmark-thumbnail').each(function () {
            const img = $(this).find('img');
            const imageUrl = img.attr('src');

            if (imageUrl) {
                const currentStyle = $(this).attr('style') || '';
                $(this).attr('style', `${currentStyle} background-image: url('${imageUrl}');`);
            }
        });
    }

    /**
     * Add a video card if raw format exists for it.
     *
     * @param $
     * @param {string} postUrl - Post url to add to anchor tag.
     */
    static #video($, postUrl) {
        const videoFigures = $('.kg-card.kg-video-card');
        videoFigures.each(function () {
            const figure = $(this);
            let thumbnailUrl = figure.attr('data-kg-custom-thumbnail');
            if (!thumbnailUrl) thumbnailUrl = figure.attr('data-kg-thumbnail');
            if (!thumbnailUrl) thumbnailUrl = 'https://img.spacergif.org/v1/1280x720/0a/spacer.png';

            const videoContent = `
                <a href="${postUrl}" target="_blank">
                    <div class="kg-video-container">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" background="${thumbnailUrl}" role="presentation" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%; background-size: cover; min-height: 200px; background: url('${thumbnailUrl}') left top / cover; mso-hide: all;">
                            <tbody>
                                <tr style="mso-hide: all">
                                    <td width="25%" style="font-size: 18px; vertical-align: top; color: #15212A; visibility: hidden; mso-hide: all;" valign="top">
                                        <img src="https://img.spacergif.org/v1/150x338/0a/spacer.png" alt="" width="100%" border="0" style="border: none; -ms-interpolation-mode: bicubic; max-width: 100%; height: auto; opacity: 0; visibility: hidden; mso-hide: all;" height="auto">
                                    </td>
                            
                                    <td width="50%" align="center" valign="middle" style="font-size: 18px; color: #15212A; vertical-align: middle; mso-hide: all;">
                                        <div class="kg-video-play-button">
                                            <div class="video-play-arrow"></div>
                                        </div>
                                    </td>
                                    <td width="25%" style="font-size: 18px; vertical-align: top; color: #15212A; mso-hide: all;" valign="top">&nbsp;</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </a>
            `;

            figure.replaceWith(videoContent);
        });
    }

    /**
     * Add an audio card if raw format exists for it.
     *
     * @param $
     * @param {string} postUrl - Post url to add to anchor tag.
     */
    static #audio($, postUrl) {
        const audioFigures = $('.kg-card.kg-audio-card');
        audioFigures.each(function () {
            const audioFigure = $(this);
            const fileName = audioFigure.find('.kg-audio-title').text().trim();
            const duration = Miscellaneous.formatDuration(audioFigure.find('.kg-audio-duration').text().trim());

            // this is pretty huge actually!
            const audioElement = `
                <table border="0" cellpadding="0" cellspacing="0" class="kg-audio-card" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%; margin: 0 auto 1.5em; border-radius: 3px; border: 1px solid #e5eff5;" width="100%">
                <tbody>
                    <tr>
                        <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                <tbody>
                                    <tr>
                                        <!-- Audio Icon -->
                                        <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top" width="60">
                                            <a class="kg-audio-thumbnail" href="${postUrl}" target="_blank">
                                                <img alt class="kg-audio-thumbnail placeholder" height="24" src="https://static.ghost.org/v4.0.0/images/audio-file-icon.png" width="24">
                                            </a>
                                        </td>
                    
                                        <!-- File name & duration-->
                                        <td style="font-size: 18px; color: #15212A; position: relative; vertical-align: center;" valign="center">
                                            <a class="kg-audio-title-overall" href="${postUrl}" target="_blank"></a>
                                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                                    <tbody>
                                        
                                                        <!-- File name -->
                                                        <tr>
                                                            <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                                                <a class="kg-audio-title" href="${postUrl}" target="_blank">${fileName}</a>
                                                            </td>
                                                        </tr>
                            
                                                        <!-- Duration -->
                                                        <tr>
                                                            <td style=" font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                                                    <tbody>
                                                                        <tr>
                                                                            <!-- Play button -->
                                                                            <td style=" font-size: 18px; color: #15212A; vertical-align: middle;" valign="middle" width="24">
                                                                                <a class="kg-audio-play-button" href="${postUrl}" target="_blank"></a>
                                                                            </td>
                                            
                                                                            <!-- Duration & Placeholder -->
                                                                            <td style="font-size: 18px; color: #15212A; vertical-align: middle;" valign="middle">
                                                                                <a class="kg-audio-duration" href="${postUrl}" target="_blank">${duration}
                                                                                    <span class="kg-audio-link"> • Click to play audio</span>
                                                                                </a>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                </tbody>
                            </table>
                            </td>
                    </tr>
                    </tbody>
            </table>
            `;

            audioFigure.replaceWith(audioElement);
        });
    }

    /**
     * Add a file card if raw format exists for it.
     *
     * @param $
     * @param {string} postUrl - Post url to add to anchor tag.
     */
    static #file($, postUrl) {
        const files = $('.kg-card.kg-file-card');
        files.each(function () {
            const file = $(this);
            const metaData = file.find('.kg-file-card-metadata');
            const fileTitle = file.find('.kg-file-card-title').text().trim();
            const fileCaption = file.find('.kg-file-card-caption').text().trim();
            const fileName = metaData.find('.kg-file-card-filename').text().trim();
            const fileSize = metaData.find('.kg-file-card-filesize').text().trim();

            const fileElement = `
                <table border="0" cellpadding="4" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%; margin: 0 0 1.5em 0; border-radius: 3px; border: 1px solid #e5eff5;" width="100%">
                    <tbody>
                        <tr>
                            <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 18px; color: #15212A; vertical-align: middle;" valign="middle">
                                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                                    <tbody>
                                                        <tr>
                                                            <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                                                <a class="kg-file-title" href="${postUrl}" target="_blank">${fileTitle}</a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                                
                                                <table id="kg-file-caption-table" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 90%;" width="90%">
                                                    <tbody>
                                                        <tr>
                                                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                                                <a class="kg-file-description" href="${postUrl}" target="_blank">${fileCaption}</a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                                
                                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%;" width="100%">
                                                    <tbody>
                                                        <tr>
                                                            <td style="font-size: 18px; vertical-align: top; color: #15212A;" valign="top">
                                                                <a class="kg-file-meta" href="${postUrl}" target="_blank">
                                                                    <span class="kg-file-name">${fileName}</span> • ${fileSize}</a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                            
                                            <td align="center" class="kg-file-thumbnail" valign="middle" width="80">
                                                <a href="${postUrl}" target="_blank"></a>
                                                <img alt class="kg-file-thumbnail placeholder" height="24" src="https://static.ghost.org/v4.0.0/images/download-icon-darkmode.png" width="24">
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
            file.replaceWith(fileElement);
            // remove description table if we don't have a caption.
            if (!fileCaption) file.find('#kg-file-caption-table').remove();
        });
    }

    /**
     * Add a youtube card if raw format exists for it.
     *
     * @param $
     * @param {Set<string>} trackedLinks
     * @param {boolean} isTracking
     */
    static async #youtubeOrVimeo($, trackedLinks, isTracking) {
        const embedCards = $('.kg-card.kg-embed-card').toArray();
        const promises = embedCards.map(async (element) => {
            const embedCard = $(element);
            const iframe = embedCard.find('iframe');
            if (!iframe.length || !iframe.attr('src')) return;

            const embedUrl = iframe.attr('src');
            const isVimeo = embedUrl.includes('vimeo.com/video/');
            const isYoutube = embedUrl.includes('youtube.com/embed/');
            if (!isVimeo && !isYoutube) return;

            let thumbnail;
            let videoLink = '';
            let trackedVideoLink = embedUrl;

            if (isYoutube) {
                const videoId = (embedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/) || [])[1];
                if (videoId) {
                    videoLink = `https://youtu.be/${videoId}`;
                    trackedVideoLink = videoLink;
                }
            } else if (isVimeo) {
                const videoId = (embedUrl.match(/player\.vimeo\.com\/video\/([a-zA-Z0-9_-]+)/) || [])[1];
                if (videoId) {
                    videoLink = `https://vimeo.com/${videoId}`;
                    trackedVideoLink = videoLink;
                }
            }

            // If tracking is enabled, update the tracking links
            if (isTracking && videoLink) {
                trackedLinks.delete(Miscellaneous.getOriginalUrl(embedUrl));
                trackedVideoLink = `${embedUrl.split('&redirect=')[0]}&redirect=${videoLink}`;
                trackedLinks.add(videoLink);
            }

            thumbnail = await Miscellaneous.thumbnail(videoLink);

            const youtubeElement = `
                <div class="kg-card kg-embed-card" style="margin: 0 0 1.5em; padding: 0;">
                    <!--[if !mso !vml]-->
                        <a class="kg-video-preview" href="${trackedVideoLink}" target="_blank">
                            <table background="${thumbnail}" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; width: 100%; background-size: cover; min-height: 200px; background: url('${thumbnail}') left top / cover; mso-hide: all;" width="100%">
                                <tbody>
                                    <tr style="mso-hide: all">
                                        <td style="font-size: 18px; vertical-align: top; color: #15212A; visibility: hidden; mso-hide: all;" valign="top" width="25%">
                                            <img alt="" border="0" height="auto" src="https://img.spacergif.org/v1/150x450/0a/spacer.png" style="border: none; -ms-interpolation-mode: bicubic; max-width: 100%; height: auto; opacity: 0; visibility: hidden; mso-hide: all;" width="100%">
                                        </td>
                                        
                                        <td align="center" style="font-size: 18px; color: #15212A; vertical-align: middle; mso-hide: all;" valign="middle" width="50%">
                                            <div class="kg-video-play-button">
                                                <div style="display: block; width: 0; height: 0; margin: 0 auto; line-height: 0; border-color: transparent transparent transparent white; border-style: solid; border-width: 0.8em 0 0.8em 1.5em; mso-hide: all;"></div>
                                            </div>
                                        </td>
                                        
                                        <td style="font-size: 18px; vertical-align: top; color: #15212A; mso-hide: all;" valign="top" width="25%">&nbsp;</td>
                                    </tr>
                                </tbody>
                            </table>
                        </a>
                    <!--[endif]-->
    
                    <!--[if vml]>
                        <v:group xmlns:v="urn:schemas-microsoft-com:vml" coordsize="600,450" coordorigin="0,0" href="${videoLink}" style="width:600px;height:450px;">
                            <v:rect fill="t" stroked="f" style="position:absolute;width:600;height:450;">
                                <v:fill src="${thumbnail}" type="frame"/>
                            </v:rect>
                        
                            <v:oval fill="t" strokecolor="white" strokeweight="4px" style="position:absolute;left:261;top:186;width:78;height:78">
                                <v:fill color="black" opacity="30%"/>
                            </v:oval>
                        
                            <v:shape coordsize="24,32" path="m,l,32,24,16,xe" fillcolor="white" stroked="f" style="position:absolute;left:289;top:208;width:30;height:34;"/>
                        </v:group>
                    <![endif]-->
                </div>
            `;
            embedCard.replaceWith(youtubeElement);
        });

        await Promise.all(promises);
    }

    /**
     * Add a twitter card if raw format exists for it.
     *
     * @param $
     */
    static #twitter_x($) {
        const embedCards = $('.kg-card.kg-embed-card');
        embedCards.each(function () {
            const embedCard = $(this);
            const twitterTweet = embedCard.find('.twitter-tweet');
            if (twitterTweet.length) {
                const innerHtml = embedCard.html();

                const replacementDiv = $('<div>')
                    .addClass('kg-card kg-embed-card')
                    .attr('style', 'margin: 0 0 1.5em; padding: 0;')
                    .html(innerHtml);

                embedCard.replaceWith(replacementDiv);
            }
        });
    }

    /**
     * Add a gallery card if raw format exists for it.
     *
     * @param $
     * @param {Set<string>} trackedLinks
     * @param {boolean} isTracking
     */
    static async #gallery($, trackedLinks, isTracking) {
        const galleryImages = $('.kg-gallery-card .kg-gallery-image img').toArray();
        const promises = galleryImages.map(async (element) => {
            const image = $(element);
            const sourceUrl = image.attr('src');
            const originalLink = Miscellaneous.getOriginalUrl(sourceUrl);

            let dimensions = {width: 600, height: 0};
            const probeSize = await probe(sourceUrl);
            dimensions.height = Math.round(probeSize.height * (dimensions.width / probeSize.width));

            let anchorTrackableUrl = originalLink;
            if (isTracking) anchorTrackableUrl = sourceUrl; // if tracking, this already is a tracked link!

            const newImageElement = `
                <a href="${anchorTrackableUrl}">
                    <img alt width="${dimensions.width}" height="${dimensions.height}" loading="lazy" src="${originalLink}">
                </a>
            `;

            image.replaceWith(newImageElement);
        });

        await Promise.all(promises);
    }

    /**
     * Add unsplash or default image card if the raw format exists for it.
     *
     * @param $
     * @param {string} postId
     * @param {Set<string>} trackedLinks
     * @param {boolean} isTracking
     */
    static async #unsplashOrImage($, postId, trackedLinks, isTracking) {
        // because we need to get the image size.
        const imageFigures = $('.kg-card.kg-image-card').toArray();
        const promises = imageFigures.map(async (element) => {
            const figure = $(element);
            let image = figure.find('img');
            let imageUrl = image.attr('src');
            let dimensions = {width: 600, height: 0};

            const imageParent = image.parent();
            const wasInsideAnchor = imageParent.is('a');

            // this already includes a tracking link
            const anchorHref = wasInsideAnchor ? imageParent.attr('href') : '';

            const caption = figure.find('figcaption');

            if (Miscellaneous.detectUnsplashImage(imageUrl)) {
                imageUrl = new URL(imageUrl);
                imageUrl.searchParams.delete('w');
                imageUrl.searchParams.delete('h');

                imageUrl.searchParams.set('w', (dimensions.width * 2).toFixed(0));
                imageUrl = imageUrl.href;
            }

            let cleanImageUrl = imageUrl;
            // replacing happens after the links have been added for tracking.
            // so, we need to remove these links, like unsplash, other images & the caption.
            if (cleanImageUrl.includes('/track/link?')) {
                cleanImageUrl = Miscellaneous.getOriginalUrl(cleanImageUrl);
                if (isTracking) trackedLinks.delete(cleanImageUrl);
            }

            // we need to remove the tracked links inside caption too!
            $(caption).find('a').each(function () {
                let anchorTag = $(this);
                let href = anchorTag.attr('href');

                // replacing happens after the links have been added for tracking.
                // so, we need to remove these links, like unsplash & the caption.
                if (href && href.includes('/track/link?')) {
                    anchorTag.attr('href', cleanImageUrl);
                    if (isTracking) trackedLinks.delete(Miscellaneous.getOriginalUrl(href));
                }
            });

            const probeSize = await probe(cleanImageUrl);
            dimensions.height = Math.round(probeSize.height * (dimensions.width / probeSize.width));

            let imageHtml = `<img alt="${image.attr('alt')}" class="kg-image" height="${dimensions.height}" loading="lazy" src="${cleanImageUrl}" width="${dimensions.width}">`;

            if (wasInsideAnchor) {
                imageHtml = `<a href="${anchorHref}">${imageHtml}</a>`;
            } else {
                const trackedAnchorLink = isTracking
                    ? await Miscellaneous.addTrackingToUrl(cleanImageUrl, postId)
                    : cleanImageUrl;
                imageHtml = `<a href="${trackedAnchorLink}">${imageHtml}</a>`;
            }

            const imageFigure = `
                <div class="kg-card kg-image-card">
                    ${imageHtml}
                    <div class="kg-image-card-caption">${caption.html()}</div>
                </div>
            `;

            figure.replaceWith(imageFigure);
            if (!caption) figure.find('.kg-image-card-caption').remove();
        });

        await Promise.all(promises);
    }

    /**
     * Inline CSS and Minify the final html.
     *
     * @param $
     * @returns {string}
     */
    static #inlineAndMinify($) {
        // a few things have been taken straight from Ghost's repo.
        const originalImageSizes = $('img').get().map((image) => {
            const src = image.attribs.src;
            const width = image.attribs.width;
            const height = image.attribs.height;
            return {src, width, height};
        });

        const inlinedCssHtml = inline($.html(), {
            keep_style_tags: true,
            inline_style_tags: true,
        });

        $ = cheerio.load(inlinedCssHtml);

        const imageTags = $('img').get();

        for (let i = 0; i < imageTags.length; i += 1) {
            if (imageTags[i].attribs.src === originalImageSizes[i].src) {
                if (imageTags[i].attribs.width === 'auto' && originalImageSizes[i].width) {
                    imageTags[i].attribs.width = originalImageSizes[i].width;
                }
                if (imageTags[i].attribs.height === 'auto' && originalImageSizes[i].height) {
                    imageTags[i].attribs.height = originalImageSizes[i].height;
                }
            }
        }

        // force all links to open in new tab
        $('a').attr('target', '_blank');

        // convert figure and figcaption to div so that Outlook applies margins.
        // styles are already inlined at this point, so it's kinda fine to do this.
        $('figure, figcaption').each((index, element) => !!(element.tagName = 'div'));

        return minify($.html(), {
            minifyCSS: true,
            removeComments: true,
            collapseWhitespace: true,
            removeAttributeQuotes: true,
        });
    }
}