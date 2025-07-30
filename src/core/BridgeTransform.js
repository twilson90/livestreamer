import stream from "node:stream";

export class BridgeTransform extends stream.Transform {
    /** @type {stream.Writable} */
    #writable;
    /** @type {stream.Readable} */
    #readable;
    /** @param {stream.Writable} writable @param {stream.Readable} readable @param {stream.TransformOptions} options */
    constructor(writable, readable, options = {}) {
        super(options);
        this.#writable = writable;
        this.#readable = readable;
    
        this.#readable.on('data', (chunk) => {
            if (this.writable) this.push(chunk); // Push data to Transform stream output
        });
    
        this.#readable.on('end', () => {
            if (this.writable) this.push(null); // End the stream
        });
    
        this.#readable.on('error', (err) => this.destroy(err));
        this.#writable.on('error', (err) => this.destroy(err));
    }
    
    _transform(chunk, encoding, callback) {
        this.#writable.write(chunk, callback);
    }
    
    _flush(callback) {
        this.#writable.end(callback); // Finish stdin
    }

    _destroy(err, callback) {
        // Clean up readable/writable
        this.#readable.destroy();
        this.#writable.destroy();
        callback(err);
    }
}