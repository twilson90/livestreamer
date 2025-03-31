
export function timeout(ms) {
	if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
	return new Promise(resolve => setTimeout(resolve, ms));
}

export default timeout;