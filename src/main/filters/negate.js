import { Filter } from "../Filter.js";
export const negate = new Filter({
	name: "negate",
	descriptive_name: "Invert",
	type: "video",
	description: `Invert the color.`,
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]negate[${v1}]`);
		ctx.vid = v1;
	}
});
export default negate;