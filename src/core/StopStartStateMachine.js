import DataNode from "../core/DataNode.js";
import globals from "./globals.js";
import * as constants from "../core/constants.js";

export default class StopStartStateMachine extends DataNode {
    
    #restart_interval;

    get state() { return this.$.state; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get time_running() { return Date.now() - this.$.start_time } // in ms

    constructor(id) {
        super(id);
        this.$.restart = 0;
        this.$.state = constants.State.STOPPED;
    }

    async _handle_end() {
        if (this.state === constants.State.STOPPING || this.state === constants.State.STOPPED) return;
        this.logger.warn(`Ended unexpectedly, attempting restart soon...`);
        await this.stop("restart");
        this.$.restart = globals.core.conf["main.stream_restart_delay"];
        this.#restart_interval = setInterval(()=>{
            this.$.restart--;
            if (this.$.restart <= 0) {
                this.start();
            }
        }, 1000);
    }

    async start(...args) {
        if (this.state === constants.State.STARTED) return;
        clearInterval(this.#restart_interval);
        this.$.start_time = Date.now();
        this.$.state = constants.State.STARTING;
        await this._start(...args);
        this.$.state = constants.State.STARTED;
    }

    async stop(reason) {
        if (this.state === constants.State.STOPPED) return;
        clearInterval(this.#restart_interval);
        this.$.state = constants.State.STOPPING;
        this.$.stop_reason = reason || "unknown";
        await this._stop(reason);
        this.$.state = constants.State.STOPPED;
    }
    
    async restart() {
        await this.stop("restart");
        await this.start();
    }

    async destroy() {
        await this.stop("destroy");
        await this._destroy();
    }

    _start(){}

    _stop(){}

    _destroy(){}
}