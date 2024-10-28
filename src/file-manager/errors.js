export class NotImplementedException extends Error {
	constructor() {
		super("Not implemented.");
	}
}
export class ErrCmdParams extends Error {
	constructor() {
		super("errCmdParams");
	}
}
export class AbortException extends Error {
	constructor() {
		super("Command aborted.");
	}
}