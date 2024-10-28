import core from "../core/index.js";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import PropertyCollection from "../core/PropertyCollection.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import Stream from "./Stream.js";

export class SessionBase extends DataNode {
    /** @type {Logger} */
    logger;

    get name() { return this.$.name; }
    get index() { return this.$.index; }
    get type() { return this.$.type; }
    get clients() { return Object.values(globals.app.clients).filter(c=>c.session === this); }
    /** @type {Stream} */
    stream;

    constructor(id, name) {
        super(id);

        /** @type {PropertyCollection} */
        let props = new this.constructor.PROPS_CLASS();
        Object.assign(this.$, props.__get_defaults(), {
            index: Object.keys(globals.app.sessions).length,
            name: name || globals.app.get_new_session_name(),
            type: this.constructor.name,
            creation_time: Date.now(),
        });

        this.logger = new Logger();
        
        let old_name, logger_prefix;
        this.logger.on("log", (log)=>{
            if (old_name !== this.$.name) {
                let parts = utils.sanitize_filename(this.$.name).split("-");
                if (parts[0] != "session") parts.unshift("session");
                old_name = this.$.name;
                logger_prefix = parts.join("-");
            }
            log.prefix = `[${logger_prefix}]${log.prefix}`;
            core.logger.log(log);
        })
        this.$.logs = this.logger.create_observer();

        globals.app.sessions[this.id] = this;
        globals.app.$.sessions[this.id] = this.$;
        core.logger.info(`Initialized session [${this.id}]`);

        core.ipc.emit("main.session.created", this.$);
    }

    rename(new_name) {
        var old_name = this.name;
        new_name = new_name.trim();
        if (old_name === new_name) return;
        this.$.name = new_name.trim();
        this.logger.info(`'${old_name}' renamed to '${this.name}'.`);
    }

    async start_stream(settings) {
        if (this.stream) return;
        var stream = new Stream(this);
        await stream.start({...this.$.stream_settings, ...settings});
    }

    // only called by client
    async stop_stream() {
        if (!this.stream) return;
        await this.stream.stop();
    }

    async destroy() {
        await this.stop_stream();

        // var index = app.sessions_ordered.indexOf(this);
        var clients = this.clients;
        
        delete globals.app.sessions[this.id];
        delete globals.app.$.sessions[this.id];

        globals.app.sessions_ordered.filter(s=>s!=this).forEach((s,i)=>s.$.index=i); // update indices

        for (var c of clients) {
            c.attach_to(null);
        }
        this.logger.info(`${this.name} was destroyed.`);

        core.ipc.emit("main.session.destroyed", this.id);

        this.logger.destroy();
        super.destroy();
    }

    tick() { }
}

const PROPS_CLASS = class extends PropertyCollection {
    constructor() {
        super();
        this.index = {
            default: -1,
        };
        this.name = {
            default: "",
        };
        this.type = {
            save: false
        };
        /* this.default_stream_title = {
            default: "",
        }; */
        this.creation_time = {
            default: 0,
        };
        this.stream_settings = {
            props: new class extends PropertyCollection {
                method = {
                    default: "rtmp",
                    options: [["gui","External Player"], ["file","File"], ["rtmp","RTMP"], ["ffplay","FFPlay"]]
                };
                targets = {
                    default: [],
                };
                test = {
                    default: false,
                };
                osc = {
                    default: false,
                };
                title = {
                    default: "",
                };
                filename = {
                    default: "%date%.mkv",
                };
                frame_rate = {
                    default: 30,
                    options: [[24,"24 fps"],[25,"25 fps"],[30,"30 fps"],[50,"50 fps"],[60,"60 fps"]]
                    // ["passthrough","Pass Through"],["vfr","Variable"],
                };
                use_hardware = {
                    default: 0,
                    options: [[0,"Off"],[1,"On"]]
                };
                legacy_mode = {
                    default: 1,
                    options: [[0,"Off"],[1,"On"]]
                };
                resolution = {
                    default: "1280x720",
                    options: [["426x240", "240p [Potato]"], ["640x360", "360p"], ["854x480", "480p [SD]"], ["1280x720", "720p"], ["1920x1080", "1080p [HD]"]]
                };
                h264_preset = {
                    default: "veryfast",
                    options: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]
                };
                video_bitrate = {
                    default: 4000
                };
                audio_bitrate = {
                    default: 160
                };
                re = {
                    default: 1
                };
            }
        };
        this.target_configs = {
            default: {},
        };
        this.logs = {
            default: {},
            save: false,
        };
        this.access_control = {
            default: { "*": { "access":"allow" } },
        };
    }
}
SessionBase.PROPS_CLASS = PROPS_CLASS;

export default SessionBase;