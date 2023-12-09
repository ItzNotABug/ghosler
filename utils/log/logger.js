import winston from 'winston';
import options from './options.js';

const winstonLogger = winston.createLogger(options);

// Log Tags for better identification.
export const logTags = Object.freeze({
    Ghost: 'Ghost',
    Files: 'Files',
    Stats: 'Stats',
    Configs: 'Configs',
    Express: 'Express',
    Newsletter: 'Newsletter',
});

/**
 * Logs a message to console only.
 *
 * @param {string} tag - The tag for the message.
 * @param {string} message - The message to be logged.
 */
export function logToConsole(tag, message) {
    console.log(`${tag}: ${message}`);
}

/**
 * Logs a debug message.
 *
 * @param {string} tag - The tag for the message.
 * @param {string} message - The message to be logged.
 * @param {boolean} [printToConsole] - If true, the message will only be logged to the console as well.
 */
export function logDebug(tag, message, printToConsole = true) {
    log(tag, message, 'debug');
    if (printToConsole) logToConsole(tag, message);
}

/**
 * Logs an error message.
 *
 * @param {string} tag - The tag for the message.
 * @param {Object} error - The error to be logged.
 */
export function logError(tag, error) {
    log(tag, error, 'error');
    logToConsole(tag, error.toString());
}

// Log given message with winston.
function log(tag, message, level) {
    let newMessage;
    if (message instanceof Error) newMessage = message.stack;
    else newMessage = message.toString();

    const messageWithTag = `${tag}: ${newMessage}`;

    if (level === 'debug') winstonLogger.debug(messageWithTag);
    else if (level === 'error') winstonLogger.error(messageWithTag);
}