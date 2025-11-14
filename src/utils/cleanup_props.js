import { fix_options } from "./fix_options.js";
import { noop } from "./noop.js";

/** @param {function(string[], any, any):boolean} */
export function cleanup_props($, props, recursive, warn, delete_unrecognized = true) {
	if (!warn) warn = noop;
	const cleanup_props = ($, props, path) => {
		let path_str = path.join(".");
		let name = path[path.length - 1];
		let value = $[name];
		let json_value = JSON.stringify(value);
		let prop = props["*"] ?? props[name];

		if (!prop) {
			warn(`Unrecognized property '${path_str}'` + (delete_unrecognized ? ", deleting..." : "")); // 
			if (delete_unrecognized) delete $[name];
			return;
		}

		if (prop.__save__ == false) {
			delete $[name];
			return;
		}

		if (prop.__custom__) return;

		if (props.__delete_nulls__) {
			if (value == null) {
				warn(`Property ${path_str} is null, deleting...`);
				delete $[name];
				return;
			}
		}

		if (props.__delete_defaults__) {
			if (json_value === JSON.stringify(prop.__default__)) {
				warn(`Property ${path_str} is same as default, deleting...`);
				delete $[name];
				return;
			}
		}

		if (prop.__options__) {
			if (prop.__options__.length > 0) {
				var options = fix_options(prop.__options__);
				if (!options.find(option => JSON.stringify(option.value) === json_value)) {
					warn(`Property value ${json_value} not in ${path_str} options, resetting to default ${JSON.stringify(prop.__default__)}...`);
					$[name] = prop.__default__;
				}
			}
		}

		if (recursive) {
			if (typeof value === "object" && value !== null) {
				for (let k of Object.keys(value)) {
					var has_default = typeof prop.__default__ === "object" && prop.__default__ !== null;
					if (has_default && k in prop.__default__) continue;
					cleanup_props(value, prop, [...path, k]);
				}
			}
		}
	};

	for (let k of Object.keys($)) {
		cleanup_props($, props, [k], props);
	}
	return $;
}

export default cleanup_props;