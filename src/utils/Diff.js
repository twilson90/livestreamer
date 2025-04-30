export class Diff {
	static CREATED = 1;
	static DELETED = 2;
	static CHANGED = 3;
	constructor(old_value, new_value, is_update=false) {
		if (!is_update && old_value === undefined) this.type = Diff.CREATED;
		else if (!is_update && new_value === undefined) this.type = Diff.DELETED;
		else this.type = Diff.CHANGED;
		this.old_value = old_value;
		this.new_value = new_value;
		Object.freeze(this);
	}
}

export default Diff;