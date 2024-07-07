import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import extract from 'extract-zip';
import ProjectConfigs from './configs.js';
import { logError, logTags } from '../log/logger.js';

/**
 * A utility class to manage import and exports of the site configurations.
 */
export default class Transfers {
    /**
     * Export the site configurations for backup.
     *
     * @param {any} res - The response object to send the `zip` to client for download.
     */
    static async export(res) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="ghosler-backup.zip"',
        );

        const filesDir = path.join(process.cwd(), 'files');
        const configsDir = path.join(process.cwd(), 'configuration');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        archive.directory(filesDir, 'files');
        archive.directory(configsDir, 'configuration');

        await archive.finalize();
    }

    /**
     * Import the site configurations from a provided backup.
     *
     * @param {any} req - The request object to get the `zip` to client for download.
     * @returns {Promise<{level: string, message: string}>} - True if import file was correctly restored, False if something went wrong.
     */
    static async import(req) {
        const importZipFile = req.files['import.file'];
        if (!importZipFile) {
            return {
                level: 'error',
                message: 'No import file was found for restore!',
            };
        }

        try {
            const tempDirectoryPath = path.join(
                os.tmpdir(),
                `import_${Date.now()}`,
            );
            await fs.mkdir(tempDirectoryPath, { recursive: true });

            const tempZipPath = path.join(tempDirectoryPath, 'import.zip');
            await importZipFile.mv(tempZipPath);

            await extract(tempZipPath, { dir: tempDirectoryPath });

            const filesDir = path.join(process.cwd(), 'files');
            const configsDir = path.join(process.cwd(), 'configuration');

            const tempFilesDir = path.join(tempDirectoryPath, 'files');
            const tempConfigsDir = path.join(
                tempDirectoryPath,
                'configuration',
            );

            // direct copy the analytics.
            await this.#copy(tempFilesDir, filesDir);

            // we need to check and verify the config file for correct schema!
            const isSchemaVerified =
                await this.#verifyConfigSchema(tempConfigsDir);
            if (!isSchemaVerified) {
                return {
                    level: 'error',
                    message: 'Configuration schema does not match!',
                };
            }

            await this.#copy(tempConfigsDir, configsDir);

            try {
                // clean up temp dir.
                await fs.rm(tempDirectoryPath);
            } catch (ignore) {
                // ignore this.
            }

            // force update the configs!
            await ProjectConfigs.reset();

            return {
                level: 'success',
                message: 'Import successful!',
            };
        } catch (error) {
            logError(logTags.Configs, error);
            return {
                level: 'error',
                message:
                    'Something went wrong while importing the configurations. Check error logs for more info.',
            };
        }
    }

    /**
     * Copy the file from source to a destination.
     *
     * @param {string} source - The directory source to copy files from.
     * @param {string} destination - The directory source to copy files to.
     */
    static async #copy(source, destination) {
        try {
            if (!(await fs.stat(source).catch(() => false))) return;

            const files = await fs.readdir(source);
            const copyPromises = files.map(async (file) => {
                const sourcePath = path.join(source, file);
                const destPath = path.join(destination, file);

                /// override the files if they exist!
                await fs.copyFile(sourcePath, destPath);
            });

            await Promise.all(copyPromises);
        } catch (error) {
            logError(logTags.Configs, `Error copying files: ${error}`);
        }
    }

    /**
     * Check if the config file has all the required schema keys.
     *
     * @param {string} source - The source directory where the config file exists.
     * @returns {Promise<boolean>} - True if all keys exists, False otherwise.
     */
    static async #verifyConfigSchema(source) {
        let fileName = 'config.production.json';
        const files = await fs.readdir(source);
        if (files.some((file) => file === 'config.local.json')) {
            fileName = 'config.local.json';
        }

        const configFile = path.join(source, fileName);
        const configFileContent = await fs.readFile(configFile, 'utf8');
        const configFileAsJson = JSON.parse(configFileContent);

        // compare the keys
        const keysToCompare = [
            'ghosler',
            'ghosler.url',
            'ghosler.port',
            'ghosler.auth',
            'ghosler.auth.user',
            'ghosler.auth.pass',

            'ghost',
            'ghost.url',
            'ghost.key',
            'ghost.secret',
            'ghost.version',

            'newsletter',
            'newsletter.track_links',
            'newsletter.center_title',
            'newsletter.show_excerpt',
            'newsletter.footer_content',
            'newsletter.show_comments',
            'newsletter.show_feedback',
            'newsletter.show_subscription',
            'newsletter.show_featured_image',
            'newsletter.show_powered_by_ghost',
            'newsletter.show_powered_by_ghosler',
            // 'newsletter.custom_subject_pattern',

            'custom_template',
            'custom_template.enabled',

            'mail',
        ];

        const comparisonSuccess = keysToCompare.every((key) => {
            let current = configFileAsJson;
            const keyParts = key.split('.');

            for (const part of keyParts) {
                if (current[part] === undefined) return false;
                current = current[part];
            }

            return true;
        });

        if (comparisonSuccess) {
            // if the backup is restored on a different domain,
            // the css and other resources [if any], will fail to load.
            // Using empty url will use a relative url which works everywhere.
            configFileAsJson.ghosler.url = '';

            try {
                await fs.writeFile(
                    path.join(source, fileName),
                    JSON.stringify(configFileAsJson),
                );
            } catch (error) {
                // this is not good, but not fatal too!
                // user might see a broken site but can probably be fixed after saving the settings.
                logError(
                    logTags.Configs,
                    'Error updating the url in the backup file. Save settings again after a successful restore to fix this.',
                );
            }
        }

        return comparisonSuccess;
    }
}
