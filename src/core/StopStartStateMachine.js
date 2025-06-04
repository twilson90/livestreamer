import {DataNodeID, DataNodeID$, constants, globals, utils} from "./exports.js";

export class StopStartStateMachine$ extends DataNodeID$ {
    restart = 0;
    state = constants.State.STOPPED;
    start_ts = 0;
    stop_ts = 0;
    stop_reason = "";
}

/** @template {StopStartStateMachine$} T @template Events @extends {DataNodeID<T, Events>} */
export class StopStartStateMachine extends DataNodeID {
    
    #restart_interval;
    #stop_promise;
    #start_promise;

    get state() { return this.$.state; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get time_running() { return Date.now() - this.$.start_ts; } // in ms

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

    start(...args) {
        clearInterval(this.#restart_interval);
        if (this.state !== constants.State.STARTING && this.state !== constants.State.STARTED) {
            this.$.state = constants.State.STARTING;
            this.$.start_ts = Date.now();
            this.#start_promise = (async ()=>{
                if (await this.onstart(...args)) {
                    this.$.state = constants.State.STARTED;
                } else {
                    this.$.state = constants.State.STOPPED;
                }
            })();
        }
        return this.#start_promise;
    }

    async stop(reason) {
        clearInterval(this.#restart_interval);
        this.$.restart = 0;
        if (this.state !== constants.State.STOPPING && this.state !== constants.State.STOPPED) {
            this.$.state = constants.State.STOPPING;
            this.#stop_promise = (async ()=>{
                this.$.stop_reason = reason || "unknown";
                this.$.stop_ts = Date.now();
                if (await this.onstop()) {
                    this.$.state = constants.State.STOPPED;
                }
            })();
        }
        return this.#stop_promise;
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