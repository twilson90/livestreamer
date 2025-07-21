import {hr_timestamp} from "./hr_timestamp.js";

export class ExponentialMovingAverage {
    #average = null;
    #alpha = 0;
    #last_elapsed = 0;
    constructor(windowSize = 60000) {
        this.#alpha = 2 / (windowSize + 1); // Convert to seconds
    }
  
    add(value, elapsed) {
        if (!elapsed) elapsed = hr_timestamp();
        const delta = elapsed - this.#last_elapsed;
        
        if (this.#average === null) {
            this.#average = value;
        } else {
            // Apply exponential decay based on elapsed time
            const effectiveAlpha = 1 - Math.pow(1 - this.#alpha, delta);
            this.#average = effectiveAlpha * value + (1 - effectiveAlpha) * this.#average;
        }

        this.#last_elapsed = elapsed;
    }
  
    get average() {
        return this.#average !== null ? this.#average : 0;
    }
}