
export * from "./index.js";
export * from "./media-server/index.js";
import config1 from "./media-server/config.default.js";
export * from "./main/index.js";
import config2 from "./main/config.default.js";
export * from "./file-manager/index.js";
import config3 from "./file-manager/config.default.js";
console.log(config1, config2, config3);
throw new Error();