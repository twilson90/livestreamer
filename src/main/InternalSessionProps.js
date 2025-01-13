import SessionBaseProps from "./SessionBaseProps.js";
/** @import {Property} from "../core/types.d.ts" */

export const PerFileProps = {
    __default__: {},
    aspect_ratio: {
        __default__: -1,
    },
    loop_file: {
        __default__: false,
    },
    vid_override: {
        __default__: null,
    },
    aid_override: {
        __default__: null,
    },
    sid_override: {
        __default__: null,
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
    audio_visualization: {
        __default__: false,
    },
    /* force_fps: {
        __default__: null,
        __options__: [[null, "Variable"], 23.976, 24, 25, 30, 50, 60],
    }, */
    volume_multiplier: {
        __default__: 1,
    },
};

const background_mode_options = [["logo",`Logo`], ["color", "Color"], ["embedded", "Embedded Artwork"], ["external", "External Artwork"]];

/** @type {Record<string,Property>} */
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
        ...PerFileProps,
        clip_start: {
            __default__: null,
        },
        clip_end: {
            __default__: null,
        },
        /* clip_loops: {
            __default__: 1,
        }, */
        clip_offset: {
            __default__: 0,
        },
        clip_duration: {
            __default__: null,
        },
        fade_in: {
            __default__: 0,
        },
        fade_out: {
            __default__: 0,
        },
        background_mode: {
            __default__: null,
            __options__: [[null, "None"], ["default", "Default Background"], ...background_mode_options],
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
        subtitle_file: {
            __default__: null,
        },
        audio_file: {
            __default__: null,
        },
        crop_left: {
            __default__: 0,
        },
        crop_top: {
            __default__: 0,
        },
        crop_right: {
            __default__: 0,
        },
        crop_bottom: {
            __default__: 0,
        },
        empty_duration: {
            __default__: 0,
        },
        title_text: {
            __default__: "",
        },
        title_size: {
            __default__: 50,
        },
        title_fade: {
            __default__: 0.5,
        },
        title_duration: {
            __default__: 5,
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
            __default__: null,
            __options__:[[null, "Do Nothing"], ["stop", "Stop Streaming"], ["handover", "Handover"]],
        },
        function_handover_session: {
            __default__: null,
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
            __default__: null,
        },
        color: {
            __default__: null,
        },
    },
}

export const Props = {
    ...SessionBaseProps, 
    playlist_id: {
        __default__: -1,
    },
    schedule_start_time: {
        __default__: null,
    },
    background_mode: {
        __default__: "logo",
        __options__: background_mode_options,
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
    interpolation_mode: {
        __default__: false,
        __options__: [["auto", "Auto"], [false, "Off"], [true, "On"]],
    },
    auto_interpolation_rate: {
        __default__: 30,
        __options__: [23.976, 24, 25, 29.97, 30, 50, 60],
    },
    files_dir: {
        __default__: "",
    },
    volume_target: {
        __default__: 100,
    },
    volume_speed: {
        __default__: 2.0,
    },
    time: {
        __default__: 0,
    },
    player_default_override: {
        ...PerFileProps
    },
    playlist: {
        __default__: {},
        __enumerable__: {
            ...PlaylistItemProps
        }
    },
    detected_crops: {
        __default__: {},
        __save__:false,
    },
    playlist_info: {
        __default__: {},
        __save__: false,
    },
    last_stream: {
        __default__: {},
        __save__: false,
    },
}

export default Props;