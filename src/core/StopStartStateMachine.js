import {DataNodeID, DataNodeID$, constants, globals} from "./exports.js";

export class StopStartStateMachine$ extends DataNodeID$ {
    restart = 0;
    state = constants.State.STOPPED;
    start_time = 0;
    stop_reason = "";
}

/** @template {StopStartStateMachine$} T @extends {DataNodeID<T>} */
export class StopStartStateMachine extends DataNodeID {
    
    #restart_interval;

    get state() { return this.$.state; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get time_running() { return Date.now() - this.$.start_time } // in ms

    /** @param {string} id @param {T} $ */
    constructor(id, $) {
        super(id, $);
    }

    async _handle_end() {
        if (this.state === constants.State.STOPPING || this.state === constants.State.STOPPED) return;
        this.logger.warn(`Ended unexpectedly, attempting restart soon...`);
        await this.stop("restart");
        this.$.restart = globals.app.conf["main.stream_restart_delay"];
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
        if (await this._start(...args)) {
            this.$.state = constants.State.STARTED;
        } else {
            this.$.state = constants.State.STOPPED;
        }
    }

    async stop(reason) {
        clearInterval(this.#restart_interval);
        if (this.state === constants.State.STOPPED) return;
        this.$.state = constants.State.STOPPING;
        this.$.stop_reason = reason || "unknown";
        if (await this._stop(reason)) {
            this.$.state = constants.State.STOPPED;
        }
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

export default StopStartStateMachine;