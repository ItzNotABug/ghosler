import * as cheerio from 'cheerio';
import Miscellaneous from './misc.js';

export default class Widgets {

    /**
     * Adds, replaces Bookmarks, Video & Audio cards.
     *
     * @param {string} content - The content to be modified.
     * @param {string} postUrl - The url of the post for redirection is template contains video.
     *
     * @returns {string} The modified content.
     */
    static replace(content, postUrl) {
        const $ = cheerio.load(content);

        this.#bookmark($);
        this.#video($, postUrl);
        this.#audio($, postUrl);
        this.#applyTargetBlank($);

        return $.html();
    }

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

        $('.kg-bookmark-container').each(function () {
            $(this).attr('style', 'border-radius: 5px; overflow:hidden;');
        });
    }

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
                        <img src="${thumbnailUrl}" alt />
                        <div class="video-play-icon"><div class="video-play-arrow"></div></div>
                    </div>
                </a>
            `;

            figure.replaceWith(videoContent);
        });
    }

    static #audio($, postUrl) {
        const audioFigures = $('.kg-card.kg-audio-card');
        audioFigures.each(function () {
            const audioFigure = $(this);
            const fileName = audioFigure.find('.kg-audio-title').text().trim();
            const duration = Miscellaneous.formatDuration(audioFigure.find('.kg-audio-duration').text().trim());

            // this is pretty huge actually!
            const replacementAudioElement = `
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
                                                                                    <span class="kg-audio-link" style="color: #738a94;"> • Click to play audio</span>
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

            audioFigure.replaceWith(replacementAudioElement);
        });
    }

    static #applyTargetBlank($) {
        $('a').attr('target', '_blank');
    }
}