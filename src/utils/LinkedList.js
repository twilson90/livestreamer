/** @template T */
class Node {
    /** @param {T} value @param {Node<T>} next */
    constructor(value, next = null) {
        this.value = value;
        this.next = next;
    }
}

/** @template T */
export class LinkedList {
    constructor() {
        /** @type {Node<T>} */
        this.head = null;
        /** @type {Node<T>} */
        this.tail = null;
        this.length = 0;
    }

    /** @param {T} value */
    append(value) {
        const newNode = new Node(value);
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.length++;
        return this;
    }

    /** @param {T} value */
    prepend(value) {
        const newNode = new Node(value, this.head);
        this.head = newNode;
        if (!this.tail) {
            this.tail = newNode;
        }
        this.length++;
        return this;
    }

    /** @param {number} index @param {T} value */
    insert(index, value) {
        if (index >= this.length) {
            return this.append(value);
        }
        if (index === 0) {
            return this.prepend(value);
        }
        const leader = this.traverseToIndex(index - 1);
        const newNode = new Node(value, leader.next);
        leader.next = newNode;
        this.length++;
        return this;
    }

    /** @param {number} index */
    remove(index) {
        if (index < 0 || index >= this.length) return null;
        
        if (index === 0) {
            const removedNode = this.head;
            this.head = this.head.next;
            this.length--;
            if (this.length === 0) {
                this.tail = null;
            }
            return removedNode;
        }
        
        const leader = this.traverseToIndex(index - 1);
        const removedNode = leader.next;
        leader.next = removedNode.next;
        
        if (index === this.length - 1) {
            this.tail = leader;
        }
        
        this.length--;
        return removedNode;
    }

    /** @param {number} index */
    traverseToIndex(index) {
        let counter = 0;
        let currentNode = this.head;
        
        while (counter !== index) {
            currentNode = currentNode.next;
            counter++;
        }
        
        return currentNode;
    }

    /** @returns {LinkedList<T>} */
    reverse() {
        if (!this.head.next) return this;
        
        let first = this.head;
        this.tail = this.head;
        let second = first.next;
        
        while (second) {
            const temp = second.next;
            second.next = first;
            first = second;
            second = temp;
        }
        
        this.head.next = null;
        this.head = first;
        return this;
    }
}