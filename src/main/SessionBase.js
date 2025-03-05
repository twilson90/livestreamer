import path from "node:path";
import fs from "fs-extra";
import * as utils from "../core/utils.js";
import DataNode from "../core/DataNode.js";
import Logger from "../core/Logger.js";
import globals from "./globals.js";
import ClientUpdater from "../core/ClientUpdater.js";
import Stream from "./Stream.js";
import * as constants from "../core/constants.js";

export class SessionBase extends DataNode {
    /** @type {Logger} */
    logger;

    get name() { return this.$.name; }
    get index() { return this.$.index; }
    get type() { return this.$.type; }
    get clients() { return Object.values(globals.app.clients).filter(c=>c.session === this); }

    /** @type {Stream} */
    stream;

    reset() {
        Object.assign(this.$, this.defaults);
    }

    constructor(type, defaults, id, name) {
        super(id);

        this.defaults = {
            ...utils.json_copy(defaults),
            type,
            index: Object.keys(globals.app.sessions).length,
            name: name || globals.app.get_new_session_name(),
            creation_time: Date.now(),
        };
        this.reset();

        this.logger = new Logger();

        let old_name, logger_prefix;
        var update_logger_prefix = ()=>{
            if (old_name !== this.$.name) {
                let parts = utils.sanitize_filename(this.$.name).split("-");
                if (parts[0] != "session") parts.unshift("session");
                old_name = this.$.name;
                logger_prefix = parts.join("-");
            }
            return logger_prefix;
        }
        
        this.logger.on("log", (log)=>{
            log.prefix = [update_logger_prefix(), ...log.prefix];
            globals.app.logger.log(log);
        });
        this.$.logs = this.logger.register_changes((log)=>{
            return {...log, prefix: log.prefix.slice(2)};
        });

        this.client_updater = new ClientUpdater(this.observer, ()=>this.clients);

        globals.app.sessions[this.id] = this;
        globals.app.$.sessions[this.id] = this.$;
        globals.app.logger.info(`Initialized session [${this.id}]`);
        globals.app.ipc.emit("main.session.created", this.id);
    }

    rename(new_name) {
        var old_name = this.name;
        new_name = new_name.trim();
        if (old_name === new_name) return;
        this.$.name = new_name.trim();
        this.logger.info(`'${old_name}' renamed to '${this.name}'.`);
    }
    
    evaluate_and_sanitize_filename(file) {
        if (!file) file = "";
        file = file
            .replace(/%(date|now)%/gi, ()=>utils.date_to_string())
            .replace(/%(unix|timestamp)%/i, ()=>Date.now().toString())
            .replace(/%(session)%/i, ()=>utils.sanitize_filename(this.$.name));
        var fullpath, i = 0;
        while(true) {
            fullpath = path.resolve(path.resolve(file+(i?` (${i})`:"")));
            if (!fs.existsSync(fullpath)) break;
            ++i;
        }
        if (path.relative(globals.app.files_dir, fullpath).startsWith(".."+path.sep)) {
            throw new Error(`Bad file path: '${fullpath}'`);
        }
        return fullpath;
    }

    async start_stream(settings) {
        if (this.stream && this.stream.state !== constants.State.STOPPED) return;
        var stream = new Stream(this);
        settings = utils.merge_non_null(utils.json_copy(this.defaults.stream_settings), this.$.stream_settings, settings);
        if (await stream.start(settings)) {
            globals.app.ipc.emit("main.session.stream-started", this.id);
        }
    }

    // only called by client
    async stop_stream() {
        if (!this.stream) return;
        if (await this.stream.stop("stop")) {
            globals.app.ipc.emit("main.session.stream-stopped", this.id);
        }
    }

    async destroy() {
        this.client_updater.destroy();
        
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

        globals.app.ipc.emit("main.session.destroyed", this.id);

        // this.logger.destroy();
        super.destroy();
    }

    tick() { }

    static get_defaults(def) {
        var _process = (def)=>{
            if (def.__default__ !== undefined) {
                return utils.json_copy(def.__default__);
            }
            var defaults = {};
            for (var k in def) {
                if (k.startsWith("__")) continue;
                defaults[k] = _process(def[k]);
            }
            if (Object.keys(defaults).length) return defaults;
        }
        return _process(def);
    }
}

export default SessionBase;