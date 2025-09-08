import stream from "node:stream";
import { MpegTsDemuxer } from 'mpegts-demuxer';

export class MpegTsDemuxerPassThrough extends stream.Transform {
	/** @type {MpegTsDemuxer} */
	#demuxer;
	pts_time = 0;

	/** @param {stream.TransformOptions} options */
	constructor(time_base=90000, options=undefined) {
		super(options);
		this.#demuxer = new MpegTsDemuxer();
		this.#demuxer.on('data', (packet) => {
			if (packet.content_type != 2) return;
			let pts_time = packet.pts / time_base;
			let dts_time = packet.dts / time_base;
			let fps = time_base / packet.frame_ticks;
			if (pts_time > this.pts_time) {
				this.pts_time = pts_time;
				this.emit("packet", {...packet, pts_time, dts_time, fps}); // video packet really.
			}
		});
	}
	
	_transform(chunk, encoding, callback) {
		this.push(chunk);
		this.#demuxer.write(chunk);
		callback();
	}
}