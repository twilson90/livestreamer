import { Filter } from "../Filter.js";
export default new Filter({
	name: "avgblur",
	descriptive_name: "Average Blur",
	type: "video",
	description: `Apply average blur filter.`,
	props: {
		sizeX: {
			__name__: "Horizontal Radius",
			__description__: "Set horizontal radius size.",
			__default__: 1,
			__min__: 1
		},
		planes: {
			__name__: "Planes",
			__description__: "Set which planes to filter. By default all planes are filtered.",
			__default__: "all"
		},
		sizeY: {
			__name__: "Vertical Radius",
			__description__: "Set vertical radius size, if zero it will be same as sizeX. Default is 0.",
			__default__: 0,
			__min__: 0
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]avgblur=sizeX=${$.sizeX}:planes=${$.planes}:sizeY=${$.sizeY}[${v1}]`);
		ctx.vid = v1;
	}
});