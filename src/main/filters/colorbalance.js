import { Filter } from "../Filter.js";
export default new Filter({
	name: "colorbalance",
	descriptive_name: "Color Balance",
	type: "video",
	description: `Modify intensity of primary colors (red, green and blue) of input frames.
The filter allows an input frame to be adjusted in the shadows, midtones or highlights regions for the red-cyan, green-magenta or blue-yellow balance.
A positive adjustment value shifts the balance towards the primary color, a negative value towards the complementary color.`,
	props: {
		rs: {
			__name__: "Red Shadows",
			__description__: "Adjust red shadows (darkest pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		gs: {
			__name__: "Green Shadows",
			__description__: "Adjust green shadows (darkest pixels).", 
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bs: {
			__name__: "Blue Shadows",
			__description__: "Adjust blue shadows (darkest pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		rm: {
			__name__: "Red Midtones",
			__description__: "Adjust red midtones (medium pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		gm: {
			__name__: "Green Midtones",
			__description__: "Adjust green midtones (medium pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bm: {
			__name__: "Blue Midtones",
			__description__: "Adjust blue midtones (medium pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		rh: {
			__name__: "Red Highlights",
			__description__: "Adjust red highlights (brightest pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		gh: {
			__name__: "Green Highlights",
			__description__: "Adjust green highlights (brightest pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		bh: {
			__name__: "Blue Highlights",
			__description__: "Adjust blue highlights (brightest pixels).",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		pl: {
			__name__: "Preserve Lightness",
			__description__: "Preserve lightness when changing color balance.",
			__default__: false
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]colorbalance=rs=${$.rs}:gs=${$.gs}:bs=${$.bs}:rm=${$.rm}:gm=${$.gm}:bm=${$.bm}:rh=${$.rh}:gh=${$.gh}:bh=${$.bh}:pl=${$.pl}[${v1}]`);
		ctx.vid = v1;
	}
});