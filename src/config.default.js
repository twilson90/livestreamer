import * as resources from "./core/resources.js";

export default {
	"core.title": "Core",
	"core.description": "IPC, web proxies, process management.",
	
	"core.debug": false,
	"core.appspace": "livestreamer",
	"core.hostname": "livestreamer.localhost",
	"core.logs_max_length": 64,
	"core.logs_max_msg_length": 128 * 1024, // 128 kb
	"core.compress_logs_schedule": "* 4 * * *", // Every day @ 4:00 am
	"core.http_port": 8120,
	"core.https_port": 8121,
	"core.redirect_http_to_https": true,
	"core.auth": null,
	"core.mpv_path": "",
	"core.mpv_hwdec": null,
	"core.ffmpeg_path": "",
	"core.ffmpeg_hwaccel": null,
	"core.ffmpeg_hwenc": null,
	"core.pm2": false,
	"core.ssl_key": "{RESOURCE}ssl/livestreamer.localhost.key{/RESOURCE}",
	"core.ssl_cert": "{RESOURCE}ssl/livestreamer.localhost.pem{/RESOURCE}",
	"core.changelog": "{RESOURCE}changes.md{/RESOURCE}",
	"core.ytdl_path": "yt-dlp",
	"core.ytdl_format": [
		"bestvideo[ext=mp4][height<=?1080][vcodec*=avc1]+bestaudio",
		"bestvideo[ext=mp4][height<=?1080]+bestaudio",
		"bestvideo[ext=mp4]+bestaudio",
		"best[ext=mp4]",
		"best"
	].join("/"),
	"core.inspect": 9229,
	
	"main.title": "Live Streamer",
	"main.description": "Handles all sessions, playlists and most of the media processing.",
	"main.logo_path": "{RESOURCE}logo.png{/RESOURCE}",
	"main.autosave_interval": 30,
	"main.autosaves_limit": 128,
	"main.session_order_client": true,
	"main.targets": [],
	"main.test_stream_low_settings": true,
	"main.stream_restart_delay": 5, // 5 seconds
	"main.google_drive_credentials_path": "",
	"main.google_drive_service_account_path": "",
	"main.warn_disk_space": 0.2,
	"main.inspect": 9230,
	
	"file-manager.title": "File Manager",
	"file-manager.description": "File manager server and interface.",
	"file-manager.volumes": {},
	"file-manager.inspect": 9231,
	
	"media-server.title": "Local Media Server",
	"media-server.description": "Handles network delivery of media streams and serves them publicly.",
	"media-server.rtmp_port": 1935,
	"media-server.rtmps_port": 1936,
	"media-server.media_expire_time": 2 * 24 * 60 * 60,
	"media-server.hls_list_size": 10,
	"media-server.hls_live_window": 2 * 60 * 60, // 2 hrs
	"media-server.hls_segment_duration": 2.0,
	"media-server.keyframe_interval": 0,
	"media-server.allow_hardware": true,
	"media-server.allow_hevc": true,
	"media-server.logo_path": "",
	"media-server.site_url": "",
	"media-server.inspect": 9232,
}