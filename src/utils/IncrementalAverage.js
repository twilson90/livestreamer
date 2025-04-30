import { sum } from "./sum.js";
export class IncrementalAverage {
    #average = 0;
    #count = 0;
    get count() { return this.#count; }
    get average() { return this.#average; }

    add_values(...values) {
        const total = sum(values);
        const len = values.length;
        this.#average = (this.#average * this.#count + total) / (this.#count + len);
        this.#count += len;
    }
}