import { Filter } from "../Filter.js";
export const framestep = new Filter({
	name: "framestep",
	descriptive_name: "Frame Step",
	type: "video",
	description: `Select one frame every N-th frame.`,
	props: {
		step: {
			__name__: "Step",
			__description__: "Select frame after every step frames. Allowed values are positive integers higher than 0.",
			__default__: 1,
			__min__: 1,
			__max__: 1000
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]framestep=step=${$.step}[${v1}]`);
		ctx.vid = v1;
	}
});
export default framestep;