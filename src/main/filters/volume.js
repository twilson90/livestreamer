import { Filter } from "../Filter.js";
export default new Filter({
	name: "volume",
	descriptive_name: "Volume",
	type: "audio",
	description: `Adjust the volume of the audio by multiplication.`,
	props: {
		multiplier: {
			__name__: "Multiplier",
			__default__: 1.0,
			__min__: 0,
			__max__: 10,
			__step__: 0.1,
		},
	},
	apply(ctx, $) {
		let a1 = ctx.id("a");
		ctx.stack.push(`[${ctx.aid}]volume=volume=${$.multiplier}[${a1}]`);
		ctx.aid = a1;
	}
})