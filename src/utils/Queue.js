/** @template T */
class Node {
    /** @type {T} */
    value;
    /** @type {Node<T>} */
    next = null;
    /** @param {T} value */
    constructor(value) {
        this.value = value;
        this.next = null;
    }
}

/** @template T */
export class Queue {
	#length = 0;
    /** @type {Node<T>} */
    #head = null; // front
    /** @type {Node<T>} */
    #tail = null; // back
	/** @param {Iterable<T>} it */
    constructor(it) {
		if (it) {
			for (const value of it) {
				this.push(value);
			}
		}
    }

	/** @param {T} value */
    push(value) {
        const node = new Node(value);

        if (this.tail) {
            this.tail.next = node;
        } else {
            this.#head = node;
        }

        this.tail = node;
        this.#length++;
    }

	/** @return {T} */
    shift() {
        if (!this.#head) return undefined;

        const value = this.#head.value;
        this.#head = this.#head.next;
        this.#length--;
        if (!this.#head) {
            this.tail = null;
        }

        return value;
    }

    clear() {
        this.#head = null;
        this.tail = null;
        this.#length = 0;
    }

    get length() {
        return this.#length;
    }

    peek() {
        return this.#head ? this.#head.value : undefined;
    }

    *[Symbol.iterator]() {
        let current = this.#head;
        while (current) {
            yield current.value;
            current = current.next;
        }
    }
}