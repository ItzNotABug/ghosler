import path from 'path';
import fs from 'fs/promises';
import {fileURLToPath} from 'url';
import Miscellaneous from '../misc.js';
import {logError, logTags} from '../log/logger.js';

/**
 * A class to handle project configuration settings.
 */
export default class ProjectConfigs {

    /**
     * Retrieves the Ghosler (Ghost Newsletter Service) configuration.
     *
     * @returns {Promise<Object>} The Ghosler configuration object.
     * @throws {Error} If the configuration is missing or invalid.
     */
    static async ghosler() {
        const configs = await this.#getConfigs();
        return configs.ghosler;
    }

    /**
     * Retrieves the ghost site configuration.
     *
     * @returns {Promise<Object>} The site configuration object.
     * @throws {Error} If the configuration is missing or invalid.
     */
    static async ghost() {
        const configs = await this.#getConfigs();
        return configs.ghost;
    }

    /**
     * Retrieves the newsletter configuration for customization.
     *
     * @returns {Promise<Object>} The newsletter configuration object.
     * @throws {Error} If the configuration is missing or invalid.
     */
    static async newsletter() {
        const configs = await this.#getConfigs();
        return configs.newsletter;
    }

    /**
     * Retrieves the mail configuration.
     *
     * @returns {Promise<Object>} The mail configuration object.
     * @throws {Error} If the configuration is missing or invalid.
     */
    static async mail() {
        const configs = await this.#getConfigs();
        return configs.mail;
    }

    /**
     * Get all the configurations.
     *
     * @returns {Promise<Object>} The saved configurations.
     * @throws {Error} If there's an issue reading or parsing the configuration file.
     */
    static async all() {
        return await this.#getConfigs();
    }

    /**
     * Internal method to read and parse the configuration file.
     *
     * @returns {Promise<Object>} Parsed configuration data.
     * @throws {Error} If there's an issue reading or parsing the configuration file.
     */
    static async #getConfigs() {
        try {
            const filePath = await this.#getConfigFilePath();
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logError(logTags.Configs, error);
            return {};
        }
    }

    /**
     * Updates the user configurations.
     *
     * @param {FormData} formData The updated info.
     * @param {boolean} isPasswordUpdate Whether this a password update.
     * @returns {Promise<{level: string, message: string}>} True if updated, false if something went wrong.
     */
    static async update(formData, isPasswordUpdate = false) {
        const configs = await this.all();

        if (isPasswordUpdate) {
            const currentPass = formData['ghosler.auth.pass'];
            if (Miscellaneous.hash(currentPass) !== configs.ghosler.auth.pass) {
                return {level: 'error', message: 'Current password not correct.'};
            }

            const newPass = formData['ghosler.auth.new_pass'];
            const newPassAgain = formData['ghosler.auth.new_pass_confirm'];

            if (newPass.toString().length < 8) {
                return {level: 'error', message: 'New password should at-least be 8 characters long.'};
            }

            if (newPassAgain !== newPass) {
                return {level: 'error', message: 'New Password & Confirmation Password do not match!'};
            }

            configs.ghosler.auth.pass = Miscellaneous.hash(newPass);

            const success = await this.#write(configs);
            if (success) return {level: 'success', message: 'Password updated!'};
            else return {level: 'error', message: 'Error updating password, check error logs for more info.'};
        }

        const url = formData['ghosler.url'];
        const user = formData['ghosler.auth.user'];

        const ghostUrl = formData['ghost.url'];
        const ghostAdminKey = formData['ghost.key'];
        const newsletterCenterTitle = formData['newsletter.center_title'];
        const newsletterShowComments = formData['newsletter.show_comments'];
        const newsletterShowLatestPosts = formData['newsletter.show_latest_posts'];
        const newsletterShowSubscription = formData['newsletter.show_subscription'];
        const newsletterShowFeaturedImage = formData['newsletter.show_featured_image'];
        const newsletterFooterContent = formData['newsletter.footer_content'];
        const newsletterPoweredByGhost = formData['newsletter.show_powered_by_ghost'];
        const newsletterPoweredByGhosler = formData['newsletter.show_powered_by_ghosler'];

        const email = formData['email'];
        if (!Array.isArray(email) || email.length === 0) {
            return {level: 'error', message: 'Add at-least one email configuration.'};
        }

        configs.ghosler.auth.user = user;
        if (configs.ghosler.url !== url) configs.ghosler.url = url;

        if (ghostUrl === '' || ghostAdminKey === '') {
            return {level: 'error', message: 'Ghost URL or Admin API Key is missing.'};
        }

        // ghost
        configs.ghost.url = ghostUrl;
        configs.ghost.key = ghostAdminKey;

        // newsletter
        configs.newsletter.center_title = newsletterCenterTitle === 'on' ?? false;
        configs.newsletter.show_comments = newsletterShowComments === 'on' ?? true;
        configs.newsletter.show_latest_posts = newsletterShowLatestPosts === 'on' ?? false;
        configs.newsletter.show_subscription = newsletterShowSubscription === 'on' ?? false;
        configs.newsletter.show_featured_image = newsletterShowFeaturedImage === 'on' ?? true;
        configs.newsletter.show_powered_by_ghost = newsletterPoweredByGhost === 'on' ?? true;
        configs.newsletter.show_powered_by_ghosler = newsletterPoweredByGhosler === 'on' ?? true;
        configs.newsletter.footer_content = newsletterFooterContent;

        // mail configurations
        configs.mail = [...email.map(({auth_user, auth_pass, ...rest}) => {
            return {
                ...rest,
                auth: {
                    user: auth_user,
                    pass: auth_pass
                }
            };
        })];

        const success = await this.#write(configs);
        if (success) return {level: 'success', message: 'Settings updated!'};
        else return {level: 'error', message: 'Error updating settings, check error logs for more info.'};
    }

    /**
     * Update the file with latest configs.
     *
     * @param configs Configs to save.
     * @returns {Promise<boolean>} True if updated, false if something went wrong.
     */
    static async #write(configs) {
        const filePath = await this.#getConfigFilePath();

        try {
            await fs.writeFile(filePath, JSON.stringify(configs), 'utf8');
            return true;
        } catch (error) {
            logError(logTags.Configs, error);
            return false;
        }
    }

    /**
     * Retrieves the file path of the configuration file.
     *
     * @returns {Promise<string>} The file path of the debug or production configuration file.
     */
    static async #getConfigFilePath() {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const debugConfigPath = path.resolve(__dirname, '../../config.debug.json');
        const prodConfigPath = path.resolve(__dirname, '../../config.production.json');

        try {
            await fs.access(debugConfigPath);
            return debugConfigPath;
        } catch {
            return prodConfigPath;
        }
    }
}