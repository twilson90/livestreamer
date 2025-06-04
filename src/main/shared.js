import {sort} from "../utils/sort.js";

/** @import {PlaylistItem$, MediaInfo, MediaInfoStreamEx, MediaInfoStreamType} from "./exports.js" */

/** @param {PlaylistItem$} item @param {MediaInfo} media_info */
export function get_auto_background_mode(item, media_info) {
	if (item) {
		if (!item.filename || item.filename === "livestreamer://empty") return "default";
		if (item.filename === "livestreamer://intertitle") return "none";
		if (media_info && media_info.streams) {
			var audio_streams = media_info.streams.filter(s=>s.type=="audio");
			var video_streams = media_info.streams.filter(s=>s.type=="video");
			if (video_streams.length && video_streams.every(s=>s.albumart) && audio_streams.length) return "embedded";
			if (!video_streams.length && media_info.external_files) {
				var external_albumart = media_info.external_files.filter(f=>f.type === "video");
				if (external_albumart.length) return "external";
			}
			if (!video_streams.length) return "default";
		}
	}
	return null;
}

/** @param {number|"auto"} id @param {MediaInfoStreamEx[]} streams @param {MediaInfoStreamType} type */
export function get_stream_by_id(id, streams, type) {
    if (type) streams = streams.filter(s=>s.type === type)
    if (id == null || id == "auto") return get_default_stream(streams, type);
    return streams.find(s=>s.type_id == id);
}

/** @template T @param {T[]} streams @param {string} type */
export function get_default_stream(streams, type) {
	streams = [...streams];
	if (type) streams = streams.filter(s=>!s || !s.type || s.type == type);
	var index_map = new Map();
	streams.forEach((s,i)=>index_map.set(s,i));
	streams.sort((a,b)=>{
		var af = a ? +a.forced : 0;
		var bf = b ? +b.forced : 0;
		var ad = a ? +a.default : 0;
		var bd = b ? +b.default : 0;
		return (bd - ad) || (bf - af) || (index_map.get(a) - index_map.get(b));
	});
	return streams.shift();
}