export class SlidingWindowAverage {
    #windowSize = 60000;
    #granularity = 1000;
    #buckets = new Map();
    #sum = 0;
    #count = 0;
    constructor(windowSizeMs = 60000, granularity = 1000) {
        this.#windowSize = windowSizeMs;
        this.#granularity = granularity; // How often to store samples (in ms)
    }
  
    get average() {
        return this.#count > 0 ? this.#sum / this.#count : 0;
    }
  
    add(value, elapsed) {
        this.#evictOldBuckets(elapsed);
        
        const bucketTime = Math.floor(elapsed / this.#granularity) * this.#granularity;
        const bucket = this.#buckets.get(bucketTime) || { sum: 0, count: 0 };
        
        bucket.sum += value;
        bucket.count++;
        this.#buckets.set(bucketTime, bucket);
        
        this.#sum += value;
        this.#count++;
    }
  
    #evictOldBuckets(elapsed) {
        const cutoff = elapsed - this.#windowSize;
        for (const [timestamp, bucket] of this.#buckets) {
            if (timestamp < cutoff) {
                this.#sum -= bucket.sum;
                this.#count -= bucket.count;
                this.#buckets.delete(timestamp);
            }
        }
    }
}

export default SlidingWindowAverage;