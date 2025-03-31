/** @param {any[]} arr @param {any} item */
export function array_remove(arr, item) {
	var index = arr.indexOf(item);
	if (index === -1) return false;
	arr.splice(index, 1);
	return true;
}

export default array_remove;