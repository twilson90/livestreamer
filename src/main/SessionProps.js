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
    creation_time: {
        __default__: 0,
    },
    version: {
        __default__: "1.0",
    },
    access_control: {
        __custom__:true,
        __default__: { "*": { "access":"allow" } },
    },
}
export const SessionPrivateProps = {
    
    stream_settings: {
        targets: {
            __custom__: true,
            __default__: ["local"],
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
}
export default SessionProps;