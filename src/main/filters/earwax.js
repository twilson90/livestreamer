import { Filter } from "../Filter.js";

export default new Filter({
	name: "earwax",
	descriptive_name: "Earwax",
	type: "audio",
	description: `This filter adds ‘cues’ to 44.1kHz stereo (i.e. audio CD format) audio so that when listened to on headphones the stereo image is moved from inside your head (standard for headphones) to outside and in front of the listener (standard for speakers).`,
    
	apply(ctx, $) {
        let a1 = ctx.id("a");
        ctx.stack.push(`[${ctx.aid}]earwax[${a1}]`);
        ctx.aid = a1;
	}
});