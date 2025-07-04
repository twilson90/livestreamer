import { Filter } from "../Filter.js";
export const scroll = new Filter({
	name: "scroll",
	descriptive_name: "Scroll",
	type: "video",
	description: `Scroll input video horizontally and/or vertically by constant speed.`,
	props: {
		horizontal: {
			__name__: "Horizontal Speed",
			__description__: "Set the horizontal scrolling speed. Negative values change scrolling direction.",
			__default__: 0,
			__min__: -1,
			__max__: 1
		},
		vertical: {
			__name__: "Vertical Speed",
			__description__: "Set the vertical scrolling speed. Negative values change scrolling direction.",
			__default__: 0, 
			__min__: -1,
			__max__: 1
		},
		hpos: {
			__name__: "Horizontal Position",
			__description__: "Set the initial horizontal scrolling position.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		},
		vpos: {
			__name__: "Vertical Position",
			__description__: "Set the initial vertical scrolling position.",
			__default__: 0,
			__min__: 0,
			__max__: 1
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]scroll=horizontal=${$.horizontal}:vertical=${$.vertical}:hpos=${$.hpos}:vpos=${$.vpos}[${v1}]`);
		ctx.vid = v1;
	}
});
export default scroll;