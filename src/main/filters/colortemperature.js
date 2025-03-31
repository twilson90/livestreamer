import { Filter } from "../Filter.js";
export default new Filter({
	name: "colortemperature",
	descriptive_name: "Color Temperature", 
	type: "video",
	description: `Adjust color temperature in video to simulate variations in ambient color temperature.`,
	props: {
		temperature: {
			__name__: "Temperature",
			__description__: "Set the temperature in Kelvin.",
			__default__: 6500,
			__min__: 1000,
			__max__: 40000
		},
		mix: {
			__name__: "Mix",
			__description__: "Set mixing with filtered output.",
			__default__: 1,
			__min__: 0,
			__max__: 1
		},
		pl: {
			__name__: "Preserve Lightness",
			__description__: "Set the amount of preserving lightness.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colortemperature=temperature=${$.temperature}:mix=${$.mix}:pl=${$.pl}[${v1}]`);
		ctx.vid = v1;
	}
});