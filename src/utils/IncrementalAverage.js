export class IncrementalAverage {
    #average = 0;
    #count = 0;
    get count() { return this.#count; }
    get average() { return this.#average; }

    push(value) {
        this.#count++;
        this.#average = this.#average + (value - this.#average) / this.#count;
        return this.#average;
    }
    clear() {
        this.#average = 0;
        this.#count = 0;
    }
}