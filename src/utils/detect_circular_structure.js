/** @param {object[]} nodes */
export function detect_circular_structure(nodes) {
	var links = {};
	for (var { id, parent } of nodes) {
		links[parent] = links[parent] || {};
		links[parent][id] = 1;
	}
	let is_circular = (id, visited = {}) => {
		if (visited[id]) return true;
		visited[id] = 1;
		if (links[id]) {
			for (var cid in links[id]) {
				if (is_circular(cid, visited)) return true;
			}
		}
		return false;
	};
	return nodes.filter(({ id }) => is_circular(id)).map(({ id }) => id);
}

export default detect_circular_structure;