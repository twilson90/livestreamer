import { Filter } from "../Filter.js";
export const eq = new Filter({
	name: "eq",
	descriptive_name: "Contrast / Brightness / Saturation / Gamma",
	type: "video",
	description: `Set brightness, contrast, saturation and approximate gamma adjustment.`,
	props: {
		contrast: {
			__name__: "Contrast",
			__description__: "Set the contrast expression. The value must be a float value in range -1000.0 to 1000.0.",
			__default__: 1,
			__min__: -10,
			__max__: 10
		},
		brightness: {
			__name__: "Brightness",
			__description__: "Set the brightness expression. The value must be a float value in range -1.0 to 1.0.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		saturation: {
			__name__: "Saturation",
			__description__: "Set the saturation expression. The value must be a float in range 0.0 to 3.0.",
			__default__: 1,
			__min__: 0,
			__max__: 3
		},
		gamma: {
			__name__: "Gamma",
			__description__: "Set the gamma expression. The value must be a float in range 0.1 to 10.0.",
			__default__: 1,
			__min__: 0.1,
			__max__: 10
		},
		gamma_r: {
			__name__: "Red Gamma",
			__description__: "Set the gamma expression for red. The value must be a float in range 0.1 to 10.0.",
			__default__: 1,
			__min__: 0.1,
			__max__: 10
		},
		gamma_g: {
			__name__: "Green Gamma",
			__description__: "Set the gamma expression for green. The value must be a float in range 0.1 to 10.0.",
			__default__: 1,
			__min__: 0.1,
			__max__: 10
		},
		gamma_b: {
			__name__: "Blue Gamma",
			__description__: "Set the gamma expression for blue. The value must be a float in range 0.1 to 10.0.",
			__default__: 1,
			__min__: 0.1,
			__max__: 10
		},
		gamma_weight: {
			__name__: "Gamma Weight",
			__description__: "Set the gamma weight expression. It can be used to reduce the effect of a high gamma value on bright image areas.",
			__default__: 1,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]eq=contrast=${$.contrast}:brightness=${$.brightness}:saturation=${$.saturation}:gamma=${$.gamma}:gamma_r=${$.gamma_r}:gamma_g=${$.gamma_g}:gamma_b=${$.gamma_b}:gamma_weight=${$.gamma_weight}[${v1}]`);
		ctx.vid = v1;
	}
});

export default eq;