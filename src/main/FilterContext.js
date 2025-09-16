import filters from "./filters/exports.js";

export class FilterContext {
	#id_map = {};
	aid = "aid1";
	vid = "vid1";
	sid = "sid1";
    color = "#000000";
	width = 720;
	height = 1280;
	fps = 30;
	/** @type {string[]} */
	stack = [];

    get aspect_ratio() {
        return this.width / this.height;
    }
    /** @param {FilterContext} d */
    constructor(d) {
        Object.assign(this, d);
    }
    /** @param {string} k */
	id(k) {
		if (!this.#id_map[k]) this.#id_map[k] = 0;
		return `${k}${this.#id_map[k]++}`;
	}
    /** @param {string} s */
    quote(s) {
        return `'${s.replace(/'/g, "\\'")}'`;
    }
	/** @param {FilterInput[]} inputs */
	push(...inputs) {
		for (var i of inputs) {
            if (!i) continue;
            if (!i.active) continue;
            if (!i.name) continue;
            /** @type {Filter} */
			let f = filters[i.name];
			if (!f) {
				console.warn(`Filter '${i.name}' not defined.`);
				continue;
			}
			var d = Object.fromEntries(Object.entries(f.props).map(([k,v])=>[k,v.__default__]));
			Object.assign(d, i.props);
			f.apply(this, d);
		}
	}
    overlay(mainid, id, position="center", shortest=true) {
        let p1 = this.pad(mainid);
        let o1 = this.id("overlay");
        var [x, y] = position_map[position];
        this.stack.push(`[${p1}][${id}]overlay=x=(main_w-overlay_w)*${x}:y=(main_h-overlay_h)*${y}:shortest=${shortest?1:0}[${o1}]`);
        return o1;
    }
    pad(id, position="center") {
        var pad = this.id("pad");
        var [x, y] = position_map[position];
        this.stack.push(`[${id||this.vid}]pad=width=${this.width}:height=${this.height}:x=(ow-iw)*${x}:y=(oh-ih)*${y}:color=${this.color}[${pad}]`);
        return pad;
    }
    scale(id) {
        var scale = this.id("scale");
        this.stack.push(`[${id||this.vid}]scale=width=(iw*sar)*min(${this.width}/(iw*sar)\\,${this.height}/ih):height=ih*min(${this.width}/(iw*sar)\\,${this.height}/ih):force_divisible_by=2[${scale}]`);
        return scale;
    }
    colorgen(color, alpha=1, w=0, h=0, r=0) {
        var c1 = this.id("c");
        this.stack.push(`color=c=${color||this.color}@${alpha}:s=${w||this.width}x${h||this.height}:r=${r||this.fps}[${c1}]`);
        return c1;
    }
    alphamerge(id, alphaid) {
        var am1 = this.id("am");
        this.stack.push(`[${id}][${alphaid}]alphamerge[${am1}]`);
        return am1;
    }
	toString() {
        return this.stack.map(f=>f.replace(`[${this.vid}]`, "[vo]").replace(`[${this.aid}]`, "[ao]").replace(/;/g, "\\;")).join(";");
	}
}

const position_map = {
    center: [0.5, 0.5],
    left: [0, 0.5],
    right: [1, 0.5],
    top: [0.5, 0],
    bottom: [0.5, 1],
    top_left: [0, 0],
    top_right: [1, 0],
    bottom_left: [0, 1],
    bottom_right: [1, 1],
}