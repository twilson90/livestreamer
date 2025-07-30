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
        target_opts: {
            __custom__: true,
            __default__: {},
        },
        title: {
            __default__: "",
        },
    },
    access_control: {
        __custom__: true,
        __default__: { "*": { "access":"allow" } },
    },
}
export default SessionProps;