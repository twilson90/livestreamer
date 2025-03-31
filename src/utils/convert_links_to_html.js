/** @param {string} str */
export function convert_links_to_html(str) {
	return str.replace(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim, '<a href="$1" target="_blank">$1</a>');
}

export default convert_links_to_html;