import * as utils from "./utils.js";

export class Color {
	get r() { return this._r; }
	get g() { return this._g; }
	get b() { return this._b; }
	get h() { return this._h; }
	get s() { return this._s; }
	get l() { return this._l; }
	get a() { return this._a; }

	constructor(...components) {
		this._r = 0;
		this._g = 0;
		this._b = 0;
		this._h = 0;
		this._s = 0;
		this._l = 0;
		this._a = 1.0;

		if (components.length == 1) {
			var c = components[0];
			if (Array.isArray(c)) {s
				components = [...c];
			} else if (typeof c === "object") {
				components = [c.r || c.red || 0, c.g || c.green || 0, c.b || c.blue || 0, c.a || c.alpha || 1];
			} else if (typeof c === "string") {
				if (c.charAt(0) === "#") c = c.slice(1);
				else if (c.substring(0,2) === "0x") c = c.slice(2);
				if (c.length < 6) components = c.split("").map(a=>a+a);
				else components = c.match(/.{1,2}/g);
			}
		}
		components = components.map(c=>{
			if (typeof c === "string" && c.match(/^[0-9a-f]{2}$/)) return parseInt(c,16);
			return +c;
		})
		this.from_rgba(...components);
	}

	from_hsl(h=0, s=0, l=0) { return this.from_hsla(h,s,l,1); }
	from_hsla(h=0, s=0, l=0, a=1) {
		this._h = h = utils.clamp(h, 0, 1);
		this._s = s = utils.clamp(s, 0, 1);
		this._l = l = utils.clamp(l, 0, 1);
		this._a = a = utils.clamp(a, 0, 1);
		var r, g, b;
		if (s == 0) {
			r = g = b = l;
		} else {
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = Color.hue2rgb(p, q, h + 1/3);
			g = Color.hue2rgb(p, q, h);
			b = Color.hue2rgb(p, q, h - 1/3);
		}
		this._r = Math.round(r * 255);
		this._g = Math.round(g * 255);
		this._b = Math.round(b * 255);
		return this;
	}

	from_rgb(r=0, g=0, b=0) { return this.from_rgba(r,g,b,1); }
	from_rgba(r=0, g=0, b=0, a=1) {
		this._r = r = Math.round(utils.clamp(r, 0, 255));
		this._g = g = Math.round(utils.clamp(g, 0, 255));
		this._b = b = Math.round(utils.clamp(b, 0, 255));
		this._a = a = Math.round(utils.clamp(a, 0, 1));
		r /= 255;
		g /= 255;
		b /= 255;
		var cMax = Math.max(r, g, b);
		var cMin = Math.min(r, g, b);
		var delta = cMax - cMin;
		var l = (cMax + cMin) / 2;
		var h = 0;
		var s = 0;
		if (delta == 0) h = 0;
		else if (cMax == r) h = 60 * (((g - b) / delta) % 6);
		else if (cMax == g) h = 60 * (((b - r) / delta) + 2);
		else h = 60 * (((r - g) / delta) + 4);
		s = (delta == 0) ? 0 : (delta / (1-Math.abs(2 * l - 1)));
		this._h = h;
		this._s = s;
		this._l = l;
		return this;
	}

	rgb_mix(c,m=0.5) { return this.rgba_mix(c, m); }
	rgba_mix(c, m=0.5) {
		c = new Color(c);
		return new Color(utils.lerp(this._r, c.r, m), utils.lerp(this._g, c.g, m), utils.lerp(this._b, c.b, m), utils.lerp(this._a, c.a, m));
	}
	
	hsl_mix(c,m=0.5) { return this.hsla_mix(c, m); }
	hsla_mix(c, m=0.5) {
		c = new Color(c);
		return new Color(utils.lerp(this._h, c.h, m), utils.lerp(this._s, c.s, m), utils.lerp(this._l, c.l, m), utils.lerp(this._a, c.a, m));
	}

	to_hsl_array() { return [this._h, this._s, this._l]; }
	to_rgb_array() { return [this._r, this._g, this._b]; }
	to_hsla_array() { return [this._h, this._s, this._l, this._a]; }
	to_rgba_array() { return [this._r, this._g, this._b, this._a]; }
	to_hsl_string() { return `hsl(${this._h}, ${this._s}, ${this._l})`; }
	to_rgb_string() { return `rgb(${this._r}, ${this._g}, ${this._b})`; }
	to_hsla_string() { return `hsla(${this._h}, ${this._s}, ${this._l}, ${this._a})`; }
	to_rgba_string() { return `rgba(${this._r}, ${this._g}, ${this._b}, ${this._a})`; }
	to_rgb_hex() { return `#${this._r.toString(16)}${this._g.toString(16)}${this._b.toString(16)}` }
	to_rgba_hex() { return `#${this._r.toString(16)}${this._g.toString(16)}${this._b.toString(16)}${this._a.toString(16)}` }

	toString() {
		return this.to_rgba_string();
	}

	copy() {
		var c = new Color();
		c._r = this._r;
		c._g = this._g;
		c._b = this._b;
		c._h = this._h;
		c._s = this._s;
		c._l = this._l;
		c._a = this._a;
		return c;
	}
	
	static mix(c1, c2, m=0.5) {
		return new Color(c1).mix(c2, m);
	}
	
	static hue_to_rgb(p, q, t) {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1/6) return p + (q - p) * 6 * t;
		if (t < 1/2) return q;
		if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
		return p;
	}
}

export default Color;