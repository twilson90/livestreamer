import { Filter } from "../Filter.js";
export const hflip = new Filter({
	name: "hflip",
	descriptive_name: "Horizontal Flip",
	type: "video", 
	description: `Flip the input video horizontally.`,
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]hflip[${v1}]`);
		ctx.vid = v1;
	}
});
export default hflip;