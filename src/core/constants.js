export const DIRECTORY = "directory";

export const State = new class {
    STARTED = "started";
    STARTING = "starting";
    STOPPED = "stopped";
    STOPPING = "stopping";
};

/** @typedef {State.STARTED | State.STARTING | State.STOPPED | State.STOPPING} StateType */