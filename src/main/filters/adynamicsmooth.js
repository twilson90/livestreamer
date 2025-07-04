import { Filter } from "../Filter.js";

export const adynamicsmooth = new Filter({
	name: "adynamicsmooth",
	descriptive_name: "Dynamic Smooth",
	type: "audio",
	description: `Apply dynamic smoothing to input audio stream.`,
	props: {
        sensitivity: {
            __name__: "Sensitivity",
            __description__: "Set an amount of sensitivity to frequency fluctations. Default is 2. Allowed range is from 0 to 1e+06.",
            __default__: 2,
            __min__: 0,
            __max__: 1e6,
        },
        basefreq: {
            __name__: "Base Frequency",
            __description__: "Set a base frequency for smoothing. Default value is 22050. Allowed range is from 2 to 1e+06.",
            __default__: 22050,
            __min__: 2,
            __max__: 1e6,
        }
    },
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]adynamicsmooth=sensitivity=${$.sensitivity}:basefreq=${$.basefreq}[${a1}]`);
        ctx.aid = a1;
    }
});
export default adynamicsmooth;