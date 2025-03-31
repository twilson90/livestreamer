/** @param {string} ip */
export function is_ip_local(ip) {
	return ip === "127.0.0.1" || ip === "::1" || ip == "::ffff:127.0.0.1";
}

export default is_ip_local;