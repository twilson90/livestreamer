
export function timeout(ms) {
	if (!Number.isFinite(ms) || ms <= 0) ms = 0;
	return new Promise(resolve => setTimeout(resolve, ms));
}

export default timeout;