import { Filter } from "../Filter.js";
export const lagfun = new Filter({
	name: "lagfun",
	descriptive_name: "Lag Light",
	type: "video",
	description: `Slowly update darker pixels. This filter makes short flashes of light appear longer.`,
	props: {
		decay: {
			__name__: "Decay",
			__description__: "Set factor for decaying.",
			__default__: 0.95,
			__min__: 0,
			__max__: 1
		},
		planes: {
			__name__: "Planes",
			__description__: "Set which planes to filter.",
			__default__: "all",
			__options__: ["all", "y", "u", "v"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]lagfun=decay=${$.decay}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});
export default lagfun;