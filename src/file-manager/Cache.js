export class FileManagerCache {
    /** @type {Object.<string, Promise<import("./Driver").Stat} */
    stats = {};
    /** @type {Object.<string, Promise<string[]>>} */
    dirs = {};
}

export default FileManagerCache;