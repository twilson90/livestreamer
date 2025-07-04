import {SessionProps} from "./SessionProps.js";

export {SessionProps};

class FiltersProperty {
    __default__ = [];
    __enumerable__ = {
        name: {
            __default__: "",
        },
        active: {
            __default__: true,
        },
        props: {
            __custom__: true,
        }
    }
}

export const MediaProps = {
    // __default__: {},
    aspect_ratio: {
        __default__: "auto",
        __options__: [
            ["auto", "Auto"],
            ["4:3", "4:3"],
            ["16:9", "16:9"],
            ["21:9", "21:9"],
            ["1:1", "1:1"],
            ["9:16", "9:16"]
        ],
    },
    loop_file: {
        __default__: false,
        __options__: [[false, "Off"], [true, "On"]],
    },
    vid_override: {
        __default__: "auto",
    },
    aid_override: {
        __default__: "auto",
    },
    sid_override: {
        __default__: "auto",
    },
    audio_delay: {
        __default__: 0,
    },
    sub_delay: {
        __default__: 0,
    },
    sub_scale: {
        __default__: 1.00,
    },
    sub_pos: {
        __default__: 100,
    },
    speed: {
        __default__: 1.00,
    },
    audio_pitch_correction: {
        __default__: true,
    },
    deinterlace_mode: {
        __default__: "auto",
        __options__: [["auto", "Auto"], [false, "Off"], [true, "On"]],
    },
    audio_channels: {
        __default__: "stereo",
    },
    volume_normalization: {
        __default__: "dynaudnorm1",
        __options__: [
            "dynaudnorm1",
            "dynaudnorm2",
            "loudnorm"
        ].map(o=>[o,o]),
    },
    filters: new FiltersProperty(),
    pre_filters: new FiltersProperty(),
    /* force_fps: {
        __default__: null,
        __options__: [[null, "Variable"], 23.976, 24, 25, 30, 50, 60],
    }, */
    volume_multiplier: {
        __default__: 1,
    },
    interpolation_mode: {
        __default__: "auto",
        __options__: [["auto", "Auto"], [false, "Off"], [true, "On"]],
    },
    auto_interpolation_rate: {
        __default__: 0,
        __options__: [["auto","Auto"], 23.976, 24, 25, 29.97, 30, 50, 60],
    },
};

export const PlaylistItemPropsProps = {
    ...MediaProps,
    clip_start: {
        __default__: null,
    },
    clip_end: {
        __default__: null,
    },
    clip_loops: {
        __default__: 1,
    },
    clip_offset: {
        __default__: 0,
    },
    /* clip_duration: {
        __default__: null,
    }, */
    fade_in: {
        __default__: 0,
    },
    fade_out: {
        __default__: 0,
    },
    background_mode: {
        __default__: "auto",
        __options__: [["auto", "Auto"], ["none", "None"], ["default", "Default"], ["logo",`Logo`], ["embedded", "Embedded Artwork"], ["external", "External Artwork"]],
    },
    background_color: {
        __default__: "",
    },
    video_file: {
        __default__: "",
    },
    video_file_start: {
        __default__: null,
    },
    video_file_end: {
        __default__: null,
    },
    subtitle_file: {
        __default__: "",
    },
    audio_file: {
        __default__: "",
    },
    crop: {
        __default__: [0, 0, 0, 0],
    },
    duration: {
        __default__: 0,
    },
    title_text: {
        __default__: "",
    },
    title_size: {
        __default__: 50,
    },
    title_font: {
        __default__: "Arial",
        __options__: ["Arial"].map(o=>[o,o]),
    },
    title_color: {
        __default__: "#ffffff",
    },
    title_style: {
        __default__: "",
        __options__: [["", "Regular"], ["bold", "Bold"], ["italic", "Italic"], ["bold+italic", "Bold & Italic"]],
    },
    title_alignment: {
        __default__: 5,
        __options__: [[1, "Bottom Left"], [2, "Bottom Center"], [3, "Bottom Right"], [4, "Center Left"], [5, "Center"], [6, "Center Right"], [7, "Top Left"], [8, "Top Center"], [9, "Top Right"]],
    },
    title_spacing: {
        __default__: 0,
    },
    title_outline_thickness: {
        __default__: 0,
    },
    title_outline_color: {
        __default__: "#000000",
    },
    title_shadow_depth: {
        __default__: 0,
    },
    title_shadow_color: {
        __default__: "#000000",
    },
    title_underline: {
        __default__: false,
    },
    title_rotation: {
        __default__: [0,0,0],
    },
    title_margin: {
        __default__: 10,
    },
    function: {
        __default__: "",
        __options__:[["", "Do Nothing"], ["stop", "Stop Streaming"], ["handover", "Handover"]],
    },
    function_handover_session: {
        __default__: "",
    },
    playlist_mode: {
        __default__: 0,
        __options__: [[0,"Normal"],[1,"Merged"],[2,"2-Track"]],
    },
    playlist_end_on_shortest_track: {
        __default__: false,
    },
    playlist_revert_to_video_track_audio: {
        __default__: false,
    },
    // --------
    label: {
        __default__: "",
    },
    color: {
        __default__: "",
    }
};

export const PlaylistItemProps = {
    id: {
        __default__: "",
    },
    filename: {
        __default__: "",
    },
    index: {
        __default__: 0,
    },
    track_index: {
        __default__: 0,
    },
    parent_id: {
        __default__: "0",
    },
    props: {
        ...PlaylistItemPropsProps
    },
}

export const InternalSessionProps = {
    ...SessionProps, 
    playlist_id: {
        __default__: -1,
    },
    schedule_start_time: {
        __default__: null,
    },
    background_mode: {
        __default__: "logo",
        __options__: [["none", "None"], ["logo",`Logo`], ["file", "File"]],
    },
    background_color: {
        __default__: "#000000",
    },
    background_file: {
        __default__: null,
    },
    background_file_start: {
        __default__: null,
    },
    background_file_end: {
        __default__: null,
    },
    files_dir: {
        __default__: "",
    },
    volume_target: {
        __default__: 100,
        __step__: 1,
        __min__: 0,
        __max__: 200,
    },
    volume_speed: {
        __default__: 2,
        __min__: 0,
        __max__: 20,
        __step__: 0.1,
    },
    fade_out_speed: {
        __default__: 2,
        __min__: 0,
        __max__: 20,
        __step__: 0.1,
    },
    fade_in_speed: {
        __default__: 2,
        __min__: 0,
        __max__: 20,
        __step__: 0.1,
    },
    time_pos: {
        __default__: 0,
    },
    player_default_override: {
        ...MediaProps
    },
    playlist: {
        __default__: {},
        __enumerable__: {
            ...PlaylistItemProps
        }
    }
}

export default InternalSessionProps;