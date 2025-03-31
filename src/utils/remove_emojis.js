/** @param {string} str */
export function remove_emojis(str) {
	return str.replace(emoji_regex, '');
}

export default remove_emojis;