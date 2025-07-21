export const SessionProps = {
    // id: {
    //     __default__: "-1",
    // },
    index: {
        __default__: -1,
    },
    name: {
        __default__: "",
    },
    create_ts: {
        __default__: 0,
    },
    version: {
        __default__: "1.0",
    },
    stream_settings: {
        targets: {
            __custom__: true,
            __default__: ["local"],
        },
        title: {
            __default__: "",
        },
        fps: {
            __default__: 0,
            __options__: [[0,"Variable"],[23.97,"23.97 fps"],[24,"24 fps"],[25,"25 fps"],[29.97,"29.97 fps"],[30,"30 fps"],[50,"50 fps"],[59.94,"59.94 fps"],[60,"60 fps"]]
            // ["passthrough","Pass Through"],["vfr","Variable"],
        },
        use_hardware: {
            __default__: 0,
            __options__: [[0,"Off"],[1,"On"]]
        },
        experimental_mode: {
            __default__: 0,
            __options__: [[0,"Off"],[1,"On"]]
        },
        resolution: {
            __default__: "1280x720",
            __options__: [
                ["426x240", "240p (16:9)"], ["640x360", "360p (16:9)"], ["854x480", "480p (16:9)"], ["1280x720", "720p (16:9)"], ["1920x1080", "1080p (16:9)"],
                ["320x240", "240p (4:3)"], ["480x360", "360p (4:3)"], ["640x480", "480p (4:3)"], ["960x720", "720p (4:3)"], ["1440x1080", "1080p (4:3)"],
            ]
        },
        h264_preset: {
            __default__: "veryfast",
            __options__: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]
        },
        video_bitrate: {
            __default__: 5000,
            __step__: 100,
            __min__: 500,
            __max__: 8000,
        },
        audio_bitrate: {
            __default__: 160,
            __step__: 1,
            __min__: 64,
            __max__: 1000,
        },
        buffer_duration: {
            __default__: 5,
            __step__: 1,
            __min__: 0,
            __max__: 60,
        },
    },
    access_control: {
        __custom__: true,
        __default__: { "*": { "access":"allow" } },
    },
}
export default SessionProps;