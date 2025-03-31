/** @typedef {{[0]:number, [1]:number, next:RangeTreeNode}} RangeTreeNode */
export class RangeTree {
	constructor(values) {
		/** @type {RangeTreeNode} */
		this._first = null;
		if (values) {
			for (var v of values) this.add(v[0], v[1]);
		}
	}
	get values () { return [...this]; }
	get total () {
		var a = 0;
		for (var p of this) a += p[1]-p[0];
		return a;
	}
	add(start, end) {
		if (start < 0) throw new Error(`start must be >= 0: ${start}`);
		if (start > end) throw new Error(`start must be smaller than end: ${start} > ${end}`);
		if (start == end) return;
		/** @type {RangeTreeNode} */
		let new_node = [start, end];
		if (!this._first || new_node[0] < this._first[0]) {
			new_node.next = this._first;
			this._first = new_node;
		}
		let curr = this._first;
		while (curr) {
			if (!curr.next || curr.next[0] > new_node[0]) {
				let n = curr.next;
				curr.next = new_node;
				new_node.next = n;
				if (new_node[0] <= curr[1] && new_node[0] >= curr[0]) {
					curr[1] = Math.max(new_node[1], curr[1]);
					curr.next = new_node.next;
				}
				if (new_node[1] <= curr[0] && new_node[1] >= curr[1]) {
					curr[0] = Math.min(new_node[0], curr[0]);
					curr.next = new_node.next;
				}
				while (curr.next && curr[1] >= curr.next[0]) {
					curr[1] = Math.max(curr[1], curr.next[1]);
					curr.next = curr.next.next;
				}
				break;
			}
			curr = curr.next;
		}
	}
	includes(low, high) {
		if (!high) high = low;
		for (let r of this) {
			if (low>=r[0] && high<=r[1]) return true;
		}
		return false;
	}
	*[Symbol.iterator]() {
		var next = this._first;
		while(next) {
			if (next) yield [...next];
			next = next.next;
		}
	}
}

export default RangeTree;