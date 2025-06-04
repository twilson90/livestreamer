import path from "node:path";

var dirname = import.meta.dirname;
var resources_dir = path.resolve(dirname, "resources");

export default {
	"core.title": "Core",
	"core.description": "IPC, web proxies, process management.",

	"core.hostname": "livestreamer.localhost",
	"core.logs_max_length": 64,
	"core.logs_max_msg_length": 128 * 1024, // 128 kb
	"core.ssl_key": `${resources_dir}/ssl/livestreamer.localhost-key.pem`,
	"core.ssl_cert": `${resources_dir}/ssl/livestreamer.localhost.pem`,
	"core.compress_logs_schedule": "* 4 * * *", // Every day @ 4:00 am
	"core.http_port": 8120,
	"core.https_port": 8121,
	"core.redirect_http_to_https": true,
	"core.auth": null,
	"core.mpv_path": "mpv",
	"core.mpv_hwdec": null,
	"core.mpv_hwenc": null,
	"core.ffmpeg_path": "ffmpeg",
	"core.ffmpeg_hwaccel": null,
	"core.ffmpeg_hwenc": null,
	"core.pm2": false,
	"core.changelog": `${resources_dir}/changes.md`,
	"core.ytdl_path": "yt-dlp",
	"core.ytdl_format": "bestvideo[ext=mp4][height<=?1080][vcodec*=avc1]+bestaudio[ext=m4a][acodec*=mp4a]/bestvideo[ext=mp4][height<=?1080][vcodec*=avc1]/best[ext=mp4]/best",
	
	"file-manager.title": "File Manager",
	"file-manager.description": "File manager server and interface.",
	"file-manager.volumes": [],
	"file-manager.inspect": "",
	
	"main.title": "Live Streamer",
	"main.description": "Handles all sessions, playlists and most of the media processing.",
	"main.logo_path": path.resolve(dirname, "main/assets/logo.png"),
	"main.autosave_interval": 30,
	"main.autosaves_limit": 128,
	"main.session_order_client": true,
	"main.targets": [],
	"main.inspect": "",
	"main.test_stream_low_settings": true,
	"main.stream_restart_delay": 5, // 5 seconds
	"main.google_drive_credentials_path": "",
	"main.google_drive_service_account_path": "",
	"main.warn_disk_space": 0.2,
	
	"media-server.title": "Local Media Server",
	"media-server.description": "Handles network delivery of media streams and serves them publicly.",
	"media-server.rtmp_port": 1935,
	"media-server.rtmps_port": 1936,
	"media-server.media_expire_time": 2 * 24 * 60 * 60,
	"media-server.hls_list_size": 10,
	"media-server.hls_max_duration": 2 * 60 * 60, // 2 hrs
	"media-server.hls_segment_duration": 2.0,
	"media-server.keyframe_interval": 2.0,
	"media-server.allow_hardware": false,
	"media-server.allow_hevc": false,
	"media-server.logo": "",
	"media-server.logo_url": "",
	"media-server.inspect": "",
	"media-server.outputs": [
		{
			"name": "240p",
			"resolution": 240,
			"video_bitrate": 300,
			"audio_bitrate": 64,
		},
		{
			"name": "360p",
			"resolution": 360,
			"video_bitrate": 600,
			"audio_bitrate": 128,
		},
		{
			"name": "480p",
			"resolution": 480,
			"video_bitrate": 1200,
			"audio_bitrate": 128,
		},
		{
			"name": "720p",
			"resolution": 720,
			"video_bitrate": 2000,
			"audio_bitrate": 160,
		},
		{
			"name": "1080p",
			"resolution": 1080,
			"video_bitrate": 3000,
			"audio_bitrate": 160,
		}
	]
}