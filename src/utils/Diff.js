export class Diff {
	static CREATED = 1;
	static DELETED = 2;
	static CHANGED = 3;
	constructor(old_value, new_value) {
		if (old_value === new_value) this.type = 0;
		if (old_value === undefined) this.type = Diff.CREATED;
		else if (new_value === undefined) this.type = Diff.DELETED;
		else this.type = Diff.CHANGED;
		this.old_value = old_value;
		this.new_value = new_value;
		Object.freeze(this);
	}
}

export default Diff;