import { Filter } from "../Filter.js";
export default new Filter({
	name: "colorlevels",
	descriptive_name: "Color Levels",
	type: "video",
	description: `Adjust video input frames using levels.
Input levels are used to lighten highlights (bright tones), darken shadows (dark tones), change the balance of bright and dark tones.
Output levels allows manual selection of a constrained output level range.`,
	presets: {
		"Darken Shadows": {
			rimin: 0.058,
			gimin: 0.058,
			bimin: 0.058
		},
		"Increase Contrast": {
			rimin: 0.039,
			gimin: 0.039,
			bimin: 0.039,
			rimax: 0.96,
			gimax: 0.96,
			bimax: 0.96
		},
		"Lighten Highlights": {
			rimax: 0.902,
			gimax: 0.902,
			bimax: 0.902
		},
		"Increase Brightness": {
			romin: 0.5,
			gomin: 0.5,
			bomin: 0.5
		}
	},
	props: {
		rimin: {
			__name__: "Red Input Black",
			__description__: "Adjust red input black point.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		gimin: {
			__name__: "Green Input Black",
			__description__: "Adjust green input black point.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bimin: {
			__name__: "Blue Input Black",
			__description__: "Adjust blue input black point.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		rimax: {
			__name__: "Red Input White",
			__description__: "Adjust red input white point.",
			__default__: 1,
			__min__: -1,
			__max__: 1
		},
		gimax: {
			__name__: "Green Input White",
			__description__: "Adjust green input white point.",
			__default__: 1,
			__min__: -1,
			__max__: 1
		},
		bimax: {
			__name__: "Blue Input White",
			__description__: "Adjust blue input white point.",
			__default__: 1,
			__min__: -1,
			__max__: 1
		},
		romin: {
			__name__: "Red Output Black",
			__description__: "Adjust red output black point.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		gomin: {
			__name__: "Green Output Black",
			__description__: "Adjust green output black point.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		bomin: {
			__name__: "Blue Output Black",
			__description__: "Adjust blue output black point.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		romax: {
			__name__: "Red Output White",
			__description__: "Adjust red output white point.",
			__default__: 1,
			__min__: 0,
			__max__: 1
		},
		gomax: {
			__name__: "Green Output White",
			__description__: "Adjust green output white point.",
			__default__: 1,
			__min__: 0,
			__max__: 1
		},
		bomax: {
			__name__: "Blue Output White",
			__description__: "Adjust blue output white point.",
			__default__: 1,
			__min__: 0,
			__max__: 1
		},
		preserve: {
			__name__: "Preserve Color",
			__description__: "Set preserve color mode.",
			__default__: "none",
			__options__: ["none", "lum", "max", "avg", "sum", "nrm", "pwr"]
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorlevels=rimin=${$.rimin}:gimin=${$.gimin}:bimin=${$.bimin}:rimax=${$.rimax}:gimax=${$.gimax}:bimax=${$.bimax}:romin=${$.romin}:gomin=${$.gomin}:bomin=${$.bomin}:romax=${$.romax}:gomax=${$.gomax}:bomax=${$.bomax}:preserve=${$.preserve}[${v1}]`);
		ctx.vid = v1;
	}
});
