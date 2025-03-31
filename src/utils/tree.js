/** @typedef {[id:any,pid:any]} TreeCallbackResult */
/** @template T @typedef {{value:T,children:TreeNode<T>[]}} TreeNode<T> */
/** @template T @param {T[]} list @param {function(T):TreeCallbackResult} cb */
export function tree(list, cb) {
	var nodes = {}, /** @type {TreeCallbackResult[]} */ infos = [], /** @type {TreeNode<T>[]} */ root_nodes = [];
	var i;
	for (i = 0; i < list.length; i++) {
		var info = infos[i] = cb(list[i]);
		nodes[info[0]] = {
			value: list[i],
			children: []
		};
	}
	for (i = 0; i < list.length; i++) {
		var info = infos[i];
		var node = nodes[info[0]];
		var parent_node = nodes[info[1]];
		if (parent_node) {
			parent_node.children.push(node);
		} else {
			root_nodes.push(node);
		}
	}
	return root_nodes;
}

export default tree;