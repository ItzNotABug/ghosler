import Stats from './stats.js';
import Files from '../data/files.js';
import Miscellaneous from '../misc.js';

/**
 * Represents a Post.
 */
export default class Post {
    /**
     * Creates an instance of Post.
     *
     * @param {string} [id=''] - The unique identifier for the Post.
     * @param {string} [url=''] - The URL of the Post.
     * @param {string} [date=''] - The date of the Post.
     * @param {string} [title=''] - The title of the Post.
     * @param {string} [content=''] - The content of the Post in HTML format.
     * @param {string} [primaryTag=''] - The primary tag of the Post.
     * @param {string} [excerpt=''] - The short excerpt of the Post.
     * @param {string} [featureImage=''] - The URL of the feature image of the Post.
     * @param {string} [featureImageCaption=''] - The caption of the feature image.
     * @param {string} [primaryAuthor=''] - The primary author of the Post.
     * @param {string} [visibility=''] - The visibility of the Post.
     * @param {Object[]} [tiers] - The tiers of the Post.
     * @param {Stats}  [stats=new Stats()] - The statistics related to this Post.
     */
    constructor(
        id = '',
        url = '',
        date = '',
        title = '',
        content = '',
        primaryTag = '',
        excerpt = '',
        featureImage = '',
        featureImageCaption = '',
        primaryAuthor = '',
        visibility = '',
        tiers = [],
        stats = new Stats(),
    ) {
        this.id = id;
        this.url = url;
        this.date = date;
        this.title = title;
        this.content = content;
        this.primaryTag = primaryTag;
        this.excerpt = excerpt;
        this.featureImage = featureImage;
        this.featureImageCaption = featureImageCaption;
        this.primaryAuthor = primaryAuthor;
        this.visibility = visibility;
        this.tiers = tiers;
        this.stats = stats;
    }

    /**
     * Check if this is a paying members content or not.
     *
     * @returns {boolean} True if paid post, false otherwise.
     */
    get isPaid() {
        return this.visibility === 'paid' || this.visibility === 'tiers';
    }

    /**
     * Make a Post object from the received payload.
     *
     * @param {Object} payload - The payload to create a Post from.
     * @returns {Post} The newly created Post object.
     */
    static make(payload) {
        const post = payload.post.current;

        return new Post(
            post.id,
            post.url,
            Miscellaneous.formatDate(post.published_at),
            post.title,
            post.html,
            post.primary_tag?.name ?? '',
            post.custom_excerpt ??
                post.excerpt ??
                post.plaintext?.substring(0, 75) ??
                post.title + '...',
            post.feature_image,
            post.feature_image_caption,
            post.primary_author.name,
            post.visibility,
            post.tiers,
            new Stats(),
        );
    }

    /**
     * Convert the saved post object to class.
     *
     * @param {Object} object - The saved Post object on disk.
     * @returns {Post} The newly created Post object.
     */
    static fromRaw(object) {
        const instance = new Post();
        Object.assign(instance, object);
        return instance;
    }

    /**
     * Check if we should ignore the post based on the tags it contains.
     *
     * @param payload - The payload to check against.
     * @returns {boolean} True if the internal tag is found, false otherwise.
     */
    static containsIgnoreTag(payload) {
        // it is always an array.
        const postTags = payload.post.current.tags;
        return postTags.some((tag) => tag.slug === 'ghosler_ignore');
    }

    /**
     * Save the data when first received from the webhook.
     *
     * @param {boolean} complete Whether to save the post object completely.
     * @returns {Promise<boolean>} A promise that resolves to true if file creation succeeded, false otherwise.
     */
    async save(complete = false) {
        let contentToSave = complete ? this : this.#saveable();

        if (complete) {
            // explicitly use 'Unsent' else the
            // 'Send' button won't show up in dashboard.
            contentToSave.stats.newsletterStatus = 'Unsent';

            // persisted data stores 'author' key.
            contentToSave.author = contentToSave.primaryAuthor;
        }

        return await Files.create(contentToSave);
    }

    /**
     * Saves the updated data.
     *
     * @param {boolean} complete Whether to save the post object completely.
     * @returns {Promise<boolean>} A promise that resolves to true if file creation succeeded, false otherwise.
     */
    async update(complete = false) {
        const contentToSave = complete ? this : this.#saveable();
        if (complete) {
            // persisted data stores 'author' key.
            contentToSave.author = contentToSave.primaryAuthor;
        }

        return await Files.create(contentToSave, true);
    }

    /**
     * Returns only the fields that need to be saved.
     *
     * @returns {Object} Fields that need to be saved.
     */
    #saveable() {
        return {
            id: this.id,
            url: this.url,
            date: this.date,
            title: this.title,
            author: this.primaryAuthor,
            stats: this.stats,
        };
    }
}
