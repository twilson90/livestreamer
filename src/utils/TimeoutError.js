
export class TimeoutError extends Error {
	constructor(message) {
		super(message);
		this.type = "TimeoutError";
	}
}

export default TimeoutError;