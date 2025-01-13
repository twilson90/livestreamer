import {Core} from "./index.js";
import globals from "./globals.js";
import * as utils from "./utils.js";

export {Blocklist} from "./Blocklist.js";
export {Cache} from "./Cache.js";
export {ClientBase} from "./ClientBase.js";
export {ClientServer} from "./ClientServer.js";
export {DataNode} from "./DataNode.js";
export {FFMPEGWrapper} from "./FFMPEGWrapper.js";
export {IPC} from "./IPC.js";
export {Logger} from "./Logger.js";
export {MPVWrapper} from "./MPVWrapper.js";
export {WebServer} from "./WebServer.js";
export {Core, globals, utils};

export function start(opts) {
    class App extends Core {
        constructor() {
            super("livestreamer", opts ?? {});
        }
    }
    return new App();
}

export default start;