import { Filter } from "../Filter.js";
export const vflip = new Filter({
	name: "vflip",
	descriptive_name: "Vertical Flip",
	type: "video",
	description: `Flip the input video vertically.`,
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]vflip[${v1}]`);
		ctx.vid = v1;
	}
});
export default vflip;