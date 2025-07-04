import { Filter } from "../Filter.js";

export const adelay = new Filter({
	name: "adelay",
	descriptive_name: "Delay",
	type: "audio",
	description: `Delay audio channels. Samples in delayed channels are filled with silence.`,
	props: {
        delay: {
            __name__: "Delay",
            __description__: "Delay in milliseconds.",
            __default__: 0,
            __min__: 0,
        }
	},
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]adelay=delays=${$.delay}:all=1[${a1}]`);
        ctx.aid = a1;
    }
});
export default adelay;