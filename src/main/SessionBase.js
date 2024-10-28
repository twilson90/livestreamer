import core from "../core/index.js";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import Stream from "./Stream.js";

export const Props = {
    index: {
        __default__: -1,
    },
    name: {
        __default__: "",
    },
    type: {
        __default__: "",
        __save__: false
    },
    creation_time: {
        __default__: 0,
    },
    version: {
        __default__: "1.0",
    },
    stream_settings: {
        method: {
            __default__: "rtmp",
            __options__: [["gui","External Player"], ["file","File"], ["rtmp","RTMP"], ["ffplay","FFPlay"]]
        },
        targets: {
            __default__: [],
        },
        test: {
            __default__: false,
        },
        osc: {
            __default__: false,
        },
        title: {
            __default__: "",
        },
        filename: {
            __default__: "%date%.mkv",
        },
        frame_rate: {
            __default__: 30,
            __options__: [[24,"24 fps"],[25,"25 fps"],[30,"30 fps"],[50,"50 fps"],[60,"60 fps"]]
            // ["passthrough","Pass Through"],["vfr","Variable"],
        },
        use_hardware: {
            __default__: 0,
            __options__: [[0,"Off"],[1,"On"]]
        },
        legacy_mode: {
            __default__: 1,
            __options__: [[0,"Off"],[1,"On"]]
        },
        resolution: {
            __default__: "1280x720",
            __options__: [["426x240", "240p [Potato]"], ["640x360", "360p"], ["854x480", "480p [SD]"], ["1280x720", "720p"], ["1920x1080", "1080p [HD]"]]
        },
        h264_preset: {
            __default__: "veryfast",
            __options__: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]
        },
        video_bitrate: {
            __default__: 4000
        },
        audio_bitrate: {
            __default__: 160
        },
        re: {
            __default__: 1
        },
    },
    target_configs: {
        __default__: {},
    },
    logs: {
        __default__: {},
        __save__: false,
    },
    access_control: {
        __default__: { "*": { "access":"allow" } },
    },
}

export class SessionBase extends DataNode {
    /** @type {Logger} */
    logger;

    get name() { return this.$.name; }
    get index() { return this.$.index; }
    get type() { return this.$.type; }
    get clients() { return Object.values(globals.app.clients).filter(c=>c.session === this); }
    /** @type {Stream} */
    stream;

    static Props = Props;

    constructor(type, props_def, id, name) {
        super(id);

        this.defaults = utils.properties(props_def || Props);
        Object.assign(this.$, {
            ...this.defaults,
            type,
            index: Object.keys(globals.app.sessions).length,
            name: name || globals.app.get_new_session_name(),
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
        this.$.logs = this.logger.register_observer();

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

export default SessionBase;