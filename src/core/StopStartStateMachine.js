import {DataNodeID, DataNodeID$, constants, globals, utils} from "./exports.js";

export class StopStartStateMachine$ extends DataNodeID$ {
    state = constants.State.STOPPED;
    start_ts = 0;
    stop_ts = 0;
    paused = false;
    stop_reason = "";
}

/** @template {StopStartStateMachine$} T @template Events @extends {DataNodeID<T, Events>} */
export class StopStartStateMachine extends DataNodeID {
    
    #stop_promise;
    #start_promise;
    #timer = new utils.StopWatchHR();

    get state() { return this.$.state; }
    get is_started() { return this.$.state === constants.State.STARTED; }
    get time_since_start() { return Date.now() - this.$.start_ts; } // in ms
    get time_running() { return this.#timer.elapsed; } // in ms
    get is_paused() { return !!this.$.paused; }

    /** @param {string} id @param {T} $ */
    constructor(id, $) {
        super(id, $);
    }

    start(...args) {
        if (this.state !== constants.State.STARTING && this.state !== constants.State.STARTED) {
            this.$.state = constants.State.STARTING;
            this.$.start_ts = Date.now();
            this.#start_promise = (async ()=>{
                if (await this._start(...args)) {
                    this.#timer.reset();
                    this.#timer.start();
                    this.$.state = constants.State.STARTED;
                    this.emit("started");
                    return true;
                } else {
                    this.$.state = constants.State.STOPPED;
                    this.emit("stopped");
                    return false;
                }
            })();
        }
        return this.#start_promise;
    }

    async pause() {
        if (this.$.paused) return;
        this.$.paused = true;
        this.#timer.pause();
        return this._pause();
    }

    async resume() {
        if (!this.$.paused) return;
        this.$.paused = false;
        this.#timer.resume();
        return this._resume();
    }

    async stop(reason) {
        if (this.state !== constants.State.STOPPING && this.state !== constants.State.STOPPED) {
            this.$.state = constants.State.STOPPING;
            this.#stop_promise = (async ()=>{
                this.$.stop_reason = reason || "unknown";
                this.$.stop_ts = Date.now();
                if (await this._stop()) {
                    this.$.state = constants.State.STOPPED;
                    this.emit("stopped");
                    return true;
                } else {
                    return false;
                }
            })();
        }
        return this.#stop_promise;
    }
    
    async restart(...args) {
        await this.stop("restart");
        await this.start(...args);
    }

    _start(){ return true; }

    _stop(){ return true; }

    _pause(){ return true; }

    _resume(){ return true; }

    async _destroy() {
        await this.stop("destroy");
        return super._destroy();
    }
}

export default StopStartStateMachine;