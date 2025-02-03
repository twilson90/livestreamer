export const Props = {
    index: {
        __default__: -1,
    },
    name: {
        __default__: "",
    },
    type: {
        __default__: "",
        __save__: false
    },
    creation_time: {
        __default__: 0,
    },
    version: {
        __default__: "1.0",
    },
    stream_settings: {
        targets: {
            __default__: {},
            __custom__: true,
            __enumerable__: {
                enabled: {
                    __default__: false
                }
            },
        },
        test: {
            __default__: false,
        },
        title: {
            __default__: "",
        },
        frame_rate: {
            __default__: 30,
            __options__: [[24,"24 fps"],[25,"25 fps"],[30,"30 fps"],[50,"50 fps"],[60,"60 fps"]]
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
            __options__: [["426x240", "240p [Potato]"], ["640x360", "360p"], ["854x480", "480p [SD]"], ["1280x720", "720p"], ["1920x1080", "1080p [HD]"]]
        },
        h264_preset: {
            __default__: "veryfast",
            __options__: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]
        },
        video_bitrate: {
            __default__: 5000
        },
        audio_bitrate: {
            __default__: 160
        },
    },
    stream: {
        __default__: {},
        __save__: false,
    },
    logs: {
        __default__: {},
        __save__: false,
    },
    access_control: {
        __default__: { "*": { "access":"allow" } },
        __custom__:true,
    },
}
export default Props;