import path from "node:path";
import fs from "node:fs";
import {globals, SessionStream} from "./exports.js";
import {utils, constants, DataNodeID, DataNodeID$, Logger, ClientUpdater, LogCollector, AccessControl } from "../core/exports.js";
import e from "express";

/** @import {SessionStream$, MainClient} from "./exports.js" */
/** @import {Log} from "../core/exports.js" */
/** @import * as events from "events" */

export class Session$ extends DataNodeID$ {
    name = "";
    type = "unknown";
    index = 0;
    create_ts = 0;
    /** @type {Record<PropertyKey,Log>} */
    logs = {};
    version = "1.0";
    access_control = new AccessControl().$;
    stream_settings = new StreamSettings$();
    stream_id;
}

export class StreamSettings$ {
    targets = [];
    target_opts = {};
    title = "";
}

/**
 * @typedef {{
 * "attach": [MainClient],
 * "detach": [MainClient],
 * "reset": [],
 * }} Events
 */

/** @template [T=Session$] @extends {DataNodeID<T,Events>} */
export class Session extends DataNodeID {
    /** @type {Logger} */
    logger;

    get name() { return this.$.name; }
    get index() { return this.$.index; }
    get type() { return this.$.type; }
    get clients() { return this.client_updater.clients; }
    // get clients() { return Object.values(globals.app.clients).filter(c=>c.session === this); }

    /** @type {SessionStream} */
    get stream() { return globals.app.session_streams[this.$.stream_id]; }

    reset() {
        Object.assign(this.$, this.defaults);
    }

    /** @param {string} type @param {T} $ @param {any} defaults @param {string} id @param {string} name */
    constructor(id, $, type, defaults) {

        super(id, $);
        
        $.type = type;
        $.index = Object.keys(globals.app.sessions).length;
        $.create_ts = Date.now();

        defaults = utils.json_copy(defaults);
        delete defaults.name;
        delete defaults.access_control;
        delete defaults.version;
        delete defaults.create_ts;
        delete defaults.index;
        this.defaults = defaults;

        this.reset();

        this.logger = new Logger();

        let old_name, logger_prefix;
        var update_logger_prefix = ()=>{
            if (old_name !== this.$.name) logger_prefix = null;
            if (!logger_prefix) {
                let parts = utils.sanitize_filename(this.$.name).split("-");
                if (parts[0] != "session") parts.unshift("session");
                old_name = this.$.name;
                logger_prefix = parts.join("-");
            }
            return logger_prefix;
        };
        
        globals.app.logger.add(this.logger, (log)=>({...log, prefix: [update_logger_prefix(), ...log.prefix]}));
        
        var log_collector = new LogCollector(this.$.logs);
        this.logger.on("log", (log)=>{
            log_collector.register({...log, prefix: log.prefix.slice(2)})
        });
        
        /** @type {ClientUpdater<MainClient>} */
        this.client_updater = new ClientUpdater(this.observer, ["sessions", this.id]);

        globals.app.sessions[this.id] = this;
        globals.app.$.sessions[this.id] = this.$;
        globals.app.logger.info(`Initialized session [${this.id}]`);
        globals.app.ipc.emit("main.session.created", this.$);
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
        var stream = new SessionStream();
        stream.attach(this);
        settings = utils.json_copy({
            ...utils.json_copy(this.defaults.stream_settings),
            ...utils.remove_nulls(this.$.stream_settings),
            ...utils.remove_nulls(settings || {}),
        });
        if (await stream.start(settings)) {
            globals.app.ipc.emit("main.session.stream-started", {session:this.$, settings});
            return true;
        }
        return false;
    }

    // only called by client
    async stop_stream() {
        if (!this.stream) return;
        if (await this.stream.stop("stop")) {
            globals.app.ipc.emit("main.session.stream-stopped", this.id);
        }
    }

    async _destroy() {
        
        await this.stop_stream();

        var stream = this.stream;
        if (stream) await stream.destroy();

        var clients = this.clients;
        
        delete globals.app.sessions[this.id];
        delete globals.app.$.sessions[this.id];

        globals.app.sessions_ordered.filter(s=>s!=this).forEach((s,i)=>s.$.index=i); // update indices

        for (var c of clients) {
            c.subscribe_session(null);
        }
        this.logger.info(`${this.name} was destroyed.`);

        globals.app.ipc.emit("main.session.destroyed", this.id);
        
        this.client_updater.destroy();

        this.logger.destroy();
        return super._destroy();
    }

    tick() { }
}

export default Session;