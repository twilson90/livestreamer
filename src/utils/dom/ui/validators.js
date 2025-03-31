import {is_valid_rtmp_url} from "../../is_valid_rtmp_url.js";
import {is_valid_url} from "../../is_valid_url.js";

export const not_empty = (v) => !!v || "Field cannot be empty";
export const rtmp = (v) => is_valid_rtmp_url(v) || "Invalid RTMP URL";
export const url = (v) => is_valid_url(v) || "Invalid URL";
export const json = (v) => {
    try { JSON.parse(v); return true; } catch { return "Invalid JSON"; }
};