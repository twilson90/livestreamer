export class PromisePool {
	#executing;
	#queue;
	#limit;
	get full() { return this.#executing.size >= this.#limit; }
	constructor(limit=Infinity) {
		this.#executing = new Set();
		this.#queue = [];
		this.#limit = limit;
	}
	enqueue(cb) {
		return new Promise((resolve, reject)=>{
			this.#queue.push([cb, resolve, reject]);
			this.#next();
		});
	}
	#next() {
		if (this.#queue.length == 0 || this.#executing.size >= this.#limit) return;
		const [cb, resolve, reject] = this.#queue.shift();
		const p = Promise.resolve(cb());
		this.#executing.add(p);
		p.then(resolve);
		p.catch(reject);
		p.finally(()=>{
			this.#executing.delete(p);
			this.#next();
		});
	}
}
export default PromisePool;