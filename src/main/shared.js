/** @import {PlaylistItem$, MediaInfo, MediaInfoStreamEx, MediaInfoStreamType} from "./exports.js" */

import {json_copy} from "../utils/json_copy.js";
import {basename} from "../utils/basename.js";

/** @param {PlaylistItem$} item @param {MediaInfo} media_info */
export function get_auto_background_mode(item, media_info) {
	if (item) {
		if (!item.filename || item.filename === "livestreamer://empty") return "default";
		if (item.filename === "livestreamer://intertitle") return "none";
		if (media_info && media_info.streams) {
			var audio_streams = media_info.streams.filter(s=>s.type=="audio");
			var video_streams = media_info.streams.filter(s=>s.type=="video");
			if (video_streams.length && video_streams.every(s=>s.albumart) && audio_streams.length) return "embedded";
			/* if (!video_streams.length && media_info.external_files) {
				var external_albumart = media_info.external_files.filter(f=>f.type === "video");
				if (external_albumart.length) return "external";
			} */
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

/** @param {MediaInfo} mi @param {([string, MediaInfo])[]} extras */
export function get_streams(mi, extras) {
	var streams = [];
	if (mi?.streams) streams.push(...mi.streams)
	for (var extra of extras) {
		let [type, mi] = extra
		if (mi?.streams) {
			let ex_streams = json_copy(mi.streams);
			let default_stream = get_default_stream(ex_streams, type, true);
			if (default_stream) {
				default_stream.extra = 1;
				if (!default_stream.title) default_stream.title = basename(mi.filename);
				default_stream.title = default_stream.title;
			}
			streams.push(default_stream);
		}
	}
	return streams;
}

/** @typedef {{default:boolean, forced:boolean, extra:boolean}} StreamInfo */

/** @param {StreamInfo[]} streams @param {string} type */
export function get_default_stream(streams, type, force = false) {
	if (type) {
		streams = streams.filter(s=>!s || !s.type || s.type == type);
	}

	if (!streams.length) return null;

	// 1. Pick the first `extra` stream (original)
	const extras = streams.filter(s => s.extra);
	if (extras.length >= 1) return extras[0]; // Prefer first extra

	// 1. Pick the first `default` stream (original)
	const defaults = streams.filter(s => s.default);
	if (defaults.length >= 1) return defaults[0]; // Prefer first default

	// 2. No defaults? Pick first `forced` stream (e.g., subtitles)
	const forceds = streams.filter(s => s.forced);
	if (forceds.length >= 1) return forceds[0]; // Prefer first forced
	
	if (type == "subtitle" && !force) return null;
	return streams[0];
}

export function codec_to_ext(c) {
	switch (c.toLowerCase()) {
		// video
		case "mjpeg":
		case "mjpg":
			return ".jpg";
		case "png":
			return ".png";
		case "h264":
		case "avc1":
		case "hevc":
		case "h265":
		case "hevcvideo":
		case "m4v":
			return ".mp4";
		case "vp8":
		case "vp9":
			return ".webm";
		case "av1":
			return ".mkv"; // AV1 can be in mkv or mp4
		case "theora":
			return ".ogv";
		case "avi":
			return ".avi";
		case "mov":
		case "qt":
			return ".mov";
		case "flv":
			return ".flv";
		// audio
		case "aac":
		case "adts":
		case "alac":
			return ".m4a";
		case "mp3":
			return ".mp3";
		case "flac":
			return ".flac";
		case "opus":
			return ".opus";
		case "vorbis":
			return ".ogg";
		case "eac3":
			return ".eac3";
		case "wav":
		case "pcm_s16le":
		case "pcm_s24le":
		case "pcm_s32le":
			return ".wav";
		default:
			return "";
	}
}