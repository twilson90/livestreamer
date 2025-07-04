import { Filter } from "../Filter.js";
export const avgblur = new Filter({
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
		}
	},
	apply(ctx, $) {
		let v1 = ctx.id("v");
		ctx.stack.push(`[${ctx.vid}]avgblur=sizeX=${$.sizeX}:planes=${$.planes}[${v1}]`);
		ctx.vid = v1;
	}
});
export default avgblur;