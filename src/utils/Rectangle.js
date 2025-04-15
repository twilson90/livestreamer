import {almost_equal} from "./almost_equal.js";

export class Rectangle {
	get left() { return this.x; }
	set left(value) { var d = value - this.x; this.x += d; this.width -= d; }
	get top() { return this.y; }
	set top(value) { var d = value - this.y; this.y += d; this.height -= d; }
	get right() { return this.x + this.width; }
	set right(value) { this.width += value - this.right; }
	get bottom() { return this.y + this.height; }
	set bottom(value) { this.height += value - this.bottom; }

	get center() { return {x:this.x + this.width/2, y:this.y + this.height/2}; }
	get is_empty() { return this.x == 0 && this.y == 0 && this.width == 0 && this.height == 0}
	
	constructor(...args) {
		args = (()=>{
			if (args.length == 4) return args;
			if (args.length == 2) return [0,0,...args];
			if (args.length == 1) {
				if (Array.isArray(args[0])) return args[0];
				if (typeof args[0] === "object") {
					var {x,y,width,height,left,right,bottom,top} = args[0];
					if (x == undefined) x = left;
					if (y == undefined) y = top;
					if (width == undefined) width = right-left;
					if (height == undefined) height = bottom-top;
					return [x,y,width,height];
				}
			}
			if (args.length == 0) return [0,0,0,0];
		})();
		this.x = +args[0] || 0;
		this.y = +args[1] || 0;
		this.width = +args[2] || 0;
		this.height = +args[3] || 0;
	}

	update(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		return this;
	}

	/** @param {Rectangle} r */
	constrain(r) {
		r = Rectangle.resolve(r);
		if (this.width > r.width) this.x -= (this.width - r.width) / 2;
		else {
			if (this.left < r.left) this.x -= this.left - r.left;
			if (this.right > r.right) this.x -= this.right - r.right;
		}
		if (this.height > r.height) this.y -= (this.height - r.height) / 2;
		else {
			if (this.top < r.top) this.y -= this.top - r.top;
			if (this.bottom > r.bottom) this.y -= this.bottom - r.bottom;
		}
		return this;
	}

	scale_to_fit_in_aspect(ar) {
		var w = this.width;
		var h = this.height;
		const rar = w / h;
		if (rar > ar) {
			this.width = h * ar;
			this.height = h;
		} else {
			this.width = w;
			this.height = w / ar;
		}
	}

	/** @param {Rectangle} r */
	contains(r) {
		r = Rectangle.resolve(r);
		if (r.is_empty || this.is_empty) return false;
		if (!r.width && !r.height) return r.x > this.left && r.x < this.right && r.y > this.top && r.y < this.bottom;
		return r.x > this.left && (r.x + r.width) < this.right && r.y > this.top && (r.y + r.height) < this.bottom;
	}

	/** @param {Rectangle} r */
	intersects(r) {
		r = Rectangle.resolve(r);
		if (r.is_empty || this.is_empty) return false;
		return (r.x + r.width) > this.left && r.x < this.right && (r.y + r.height) > this.top && r.y < this.bottom;
	}

	scale(x, y) {
		if (y === undefined) y = x;
		this.x *= x;
		this.y *= y;
		this.width *= x;
		this.height *= y;
		return this;
	}
	expand(x, y) {
		if (y === undefined) y = x;
		this.x -= x/2;
		this.y -= y/2;
		this.width += x;
		this.height += y;
		return this;
	}

	fix() {
		if (this.width < 0) {
			this.x += this.width;
			this.width *= -1;
		}
		if (this.height < 0) {
			this.y += this.height;
			this.height *= -1;
		}
		return this;
	}

	clone() {
		return new Rectangle(this.x, this.y, this.width, this.height);
	}

	equals(r, epsilon=Number.EPSILON) {
		r = Rectangle.resolve(r);
		return almost_equal(this.x, r.x, epsilon) &&
			almost_equal(this.y, r.y, epsilon) && 
			almost_equal(this.width, r.width, epsilon) && 
			almost_equal(this.height, r.height, epsilon)
	}

	toString() {
		return `[Rectangle x:${this.x} y:${this.y} width:${this.width} height:${this.height}]`;
	}
	/* toJSON() {
		return {x:this.x, y:this.y, width:this.width, height:this.height};
	} */

	/** @param {Rectangle[]} rects */
	static union(...rects) {
		var left = Number.POSITIVE_INFINITY;
		var top = Number.POSITIVE_INFINITY;
		var right = Number.NEGATIVE_INFINITY;
		var bottom = Number.NEGATIVE_INFINITY;
		for (var r of rects) {
			if (r.is_empty) continue;
			left = Math.min(left, r.left);
			top = Math.min(top, r.top);
			right = Math.max(right, r.right);
			bottom = Math.max(bottom, r.bottom);
		}
		return new Rectangle({left, top, right, bottom});
	}
	
	static intersection(...rects) {
		var x = Math.max(...rects.map(r=>r.x));
		var y = Math.max(...rects.map(r=>r.y));
		var right = Math.min(...rects.map(r=>r.x+r.width));
		var bottom = Math.min(...rects.map(r=>r.y+r.height));
		return new Rectangle(x, y, right - x, bottom - y);
	}

	static resolve(ob) {
		if (ob instanceof Rectangle) return ob;
		return new Rectangle(ob);
	}
}
export default Rectangle;