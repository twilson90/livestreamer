import path from "node:path";

export default {
	"core.hostname": "livestreamer.localhost",
	"core.appdata_dir": undefined,
	"core.logs_max_length": 64,
	"core.logs_max_msg_length": 128 * 1024, // 128 kb
	"core.ssl_key": "",
	"core.ssl_cert": "",
	"core.compress_logs_schedule": "* 4 * * *", // Every day @ 4:00 am
	"core.http_port": 8120,
	"core.https_port": 8121,
	"core.auth": null,
	"core.mpv_executable": "mpv",
	"core.mpv_hwdec": null,
	"core.mpv_hwenc": null,
	"core.ffmpeg_executable": "ffmpeg",
	"core.ffmpeg_hwaccel": null,
	"core.ffmpeg_hwenc": null,
	"core.ffplay_executable": "ffplay",
	"core.pm2": false,
	"core.debug": false,
	"core.changelog": "changes.md",
	
	"file-manager.title": "File Manager",
	"file-manager.description": "File manager server and interface.",
	"file-manager.volumes": [],
	"file-manager.inspect": "",
	
	"main.title": "Live Streamer",
	"main.description": "Handles all sessions, playlists and most of the media processing.",
	"main.logo_path": path.resolve(import.meta.dirname, "main/assets/logo.png"),
	"main.autosave_interval": 30,
	"main.autosaves_limit": 256,
	"main.youtube_dl": "yt-dlp",
	"main.youtube_dl_format": "bestvideo[ext=mp4][height<=?1080][vcodec*=avc1]+bestaudio[ext=m4a][acodec*=mp4a]/best[ext=mp4]/best",
	"main.session_order_client": true,
	"main.targets": [],
	"main.inspect": "",
	"main.test_stream_low_settings": true,
	"main.stream_restart_delay": 5, // 5 seconds
	
	"media-server.title": "Local Media Server",
	"media-server.description": "Handles network delivery of media streams and serves them publicly.",
	"media-server.rtmp_port": 1935,
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