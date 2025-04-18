import {DataNodeID, DataNodeID$, constants, globals} from "./exports.js";

export class StopStartStateMachine$ extends DataNodeID$ {
    restart = 0;
    state = constants.State.STOPPED;
    start_time = 0;
    stop_reason = "";
}

/** @template {StopStartStateMachine$} T @template Events @extends {DataNodeID<T, Events>} */
export class StopStartStateMachine extends DataNodeID {
    
    #restart_interval;

    get state() { return this.$.state; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get time_running() { return Date.now() - this.$.start_time } // in ms

    /** @param {string} id @param {T} $ */
    constructor(id, $) {
        super(id, $);
    }

    async _handle_end(source) {
        if (this.state === constants.State.STOPPING || this.state === constants.State.STOPPED) return;
        this.logger.warn(`${source} ended unexpectedly, attempting restart soon...`);
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
        if (this.state === constants.State.STARTING) return;
        if (this.state === constants.State.STARTED) return;
        clearInterval(this.#restart_interval);
        this.$.start_time = Date.now();
        this.$.state = constants.State.STARTING;
        if (await this.onstart(...args)) {
            this.$.state = constants.State.STARTED;
        } else {
            this.$.state = constants.State.STOPPED;
        }
    }

    async stop(reason) {
        clearInterval(this.#restart_interval);
        this.$.restart = 0;
        if (this.state === constants.State.STOPPING) return;
        if (this.state === constants.State.STOPPED) return;
        this.$.state = constants.State.STOPPING;
        this.$.stop_reason = reason || "unknown";
        if (await this.onstop()) {
            this.$.state = constants.State.STOPPED;
        }
    }
    
    async restart() {
        await this.stop("restart");
        await this.start();
    }

    onstart(){ return true; }

    onstop(){ return true; }

    async ondestroy() {
        await this.stop("destroy");
        return super.ondestroy();
    }
}

export default StopStartStateMachine;