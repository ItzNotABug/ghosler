import winston from 'winston';

/**
 * Returns the current date and time in the format [YYYY-MM-DD HH:MM:SS TZ].
 *
 * @returns {string} The formatted timestamp with timezone.
 */
const timeStamp = () => {
    let currentDate = new Date();
    return currentDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
};

/**
 * `logFormat` function that constructs a custom logging format.
 *
 * The format is structured as follows:
 * `[YYYY-MM-DD HH:MM:SS] LOG_LEVEL: Log message`
 *
 * Example:
 * `[2023-08-28 11:26:55] DEBUG: This is a debug message.`
 *
 * @returns {Function} - A Winston log formatter function.
 */
const logFormat = () => {
    return winston.format.printf((log) => {
        return `[${timeStamp()}] => [${log.level.toUpperCase()}] => ${log.message}`;
    });
};

/**
 * `filterOnly` creates a format filter that allows logging only for the specified level.
 *
 * @param {string} level - The log level to be filtered.
 * @returns {Function} - A Winston format function that filters logs based on the provided level.
 */
const filterOnly = (level) => {
    return winston.format((log) => {
        if (log.level === level) return log;
    })();
};

/**
 * `transport` creates a file transport configuration for the specified log level.
 *
 * @param {string} level - The log level for which the file transport should be configured.
 * @returns {winston.FileTransportInstance} - A Winston file transport instance configured for the specified level.
 */
const transport = (level) =>
    new winston.transports.File({
        level: level,
        dirname: '.logs',
        filename: `${level}.log`,
        format: filterOnly(level),
    });

/**
 * `options` contains the configurations for the logger.
 *
 * - `format`: The log format to use. It's defined by the `logFormat` function.
 * - `transports`: An array of transport configurations. In this case, it is set up for 'debug' and 'error' levels.
 */
const options = {
    format: logFormat(),
    transports: [transport('debug'), transport('error')],
};

export default options;
