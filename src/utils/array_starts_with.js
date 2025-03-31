/** @param {any[]} mainArray @param {any[]} subArray @return {boolean} */
export function array_starts_with(mainArray, subArray) {
	if (subArray.length > mainArray.length) return false;
	return subArray.every((element, index) => element === mainArray[index]);
}

export default array_starts_with;