import { Filter } from "../Filter.js";
export const gblur = new Filter({
	name: "gblur",
	descriptive_name: "Gaussian Blur",
	type: "video", 
	description: `Apply Gaussian blur filter.`,
	props: {
		sigma: {
			__name__: "Sigma",
			__description__: "Set sigma, standard deviation of Gaussian blur.",
			__default__: 0.5,
			__min__: 0,
			__max__: 100
		},
		steps: {
			__name__: "Steps",
			__description__: "Set number of steps for Gaussian approximation.",
			__default__: 1,
			__min__: 1,
			__max__: 100
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]gblur=sigma=${$.sigma}:steps=${$.steps}[${v1}]`);
		ctx.vid = v1;
	}
});
export default gblur;