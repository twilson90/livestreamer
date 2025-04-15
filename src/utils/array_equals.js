/** @param {any[]} arr1 @param {any[]} arr2 @return {boolean} */
export function array_equals(arr1, arr2, strict=true) {
	var length = arr1.length;
	if (length !== arr2.length) return false;
	for (var i = 0; i < length; i++) {
		if (strict && arr1[i] !== arr2[i]) return false;
		else if (!strict && arr1[i] != arr2[i]) return false;
	}
	return true;
}

export default array_equals;