import {globals, InternalSession} from "./exports.js";
import {utils, Client, Client$, constants} from "../core/exports.js";

export class MainClient$ extends Client$ {
    session_id = "";
    stream_id = "";
}

/** @extends {Client<MainClient$>} */
export class MainClient extends Client {
    get session() { return globals.app.sessions[this.$.session_id]; }
    /** @type {InternalSession} */
    get internal_session() { return this.session; }
    get session_stream() { return this.session.stream; }

    api = {
        ...super.api,
        // "analyze_local_file_system_volume": (...args)=>globals.app.analyze_local_file_system_volume(...args),
        "module_restart": (...args) => {
            return globals.app.module_restart(...args)
        },
        "module_stop": (...args) => {
            return globals.app.module_stop(...args)
        },
        "module_start": (...args) => {
            return globals.app.module_start(...args)
        },
        "create_target": (...args) => {
            return globals.app.create_target(...args)
        },
        "update_target": (...args) => {
            return globals.app.update_target(...args)
        },
        "delete_target": (...args) => {
            return globals.app.delete_target(...args)
        },
        "get_lives": (...args) => {
            return globals.app.get_lives(...args)
        },
        "destroy_live": (...args) => {
            return globals.app.destroy_live(...args)
        },
        "handover": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.handover(...args)
        },
        "get_autosave_history": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.get_autosave_history(...args)
        },
        "detect_crop": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.detect_crop(...args)
        },
        "stop_stream": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.stop_stream(...args)
        },
        "start_stream": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.start_stream(...args)
        },
        "reload": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.reload(...args)
        },
        "set_player_default_override": (...args) => {
            if (!this.internal_session) return;
            this.internal_session.set_player_default_override(...args)
        },
        "update_media_info_from_ids": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.update_media_info_from_ids(...args)
        },
        "playlist_add": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.playlist_add(...args)
        },
        "playlist_remove": (ids, session_id, opts) => {
            /** @type {InternalSession} */
            var session = globals.app.sessions[session_id] || this.internal_session;
            if (!session) return;
            return session.playlist_remove(ids, opts);
        },
        "playlist_update": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.playlist_update(...args)
        },
        "playlist_undo": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.playlist_undo(...args)
        },
        "playlist_redo": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.playlist_redo(...args)
        },
        "playlist_register_history": (...args) => {
            if (!this.internal_session) return;
            this.internal_session.playlist_history.push(...args)
        },
        "download_and_replace": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.download_and_replace(...args)
        },
        "cancel_download": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.cancel_download(...args)
        },
        "cancel_upload": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.cancel_upload(...args)
        },
        "playlist_play": (...args) => {
            if (!this.internal_session) return;
            this.internal_session.playlist_play(...args)
        },
        "seek": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.seek(...args)
        },
        "update_player_controls": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.update_player_controls(...args)
        },
        "fade_out_in": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.fade_out_in(...args)
        },
        "load_session": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.load(...args)
        },
        "load_session_autosave": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.load_autosave(...args)
        },
        "get_user_save_data": (...args) => {
            if (!this.internal_session) return;
            return this.internal_session.get_user_save_data(...args)
        },
        "pause": (...args) => {
            if (!this.session_stream) return;
            return this.session_stream.pause(...args)
        },
        "resume": (...args) => {
            if (!this.session_stream) return;
            return this.session_stream.resume(...args)
        },
        "session_update_values": (...args) => {
            if (!this.session) return;
            utils.merge(this.session.$, args[0], {delete_nulls:true})
        },
        "stream_update_values": (...args) => {
            if (!this.session_stream) return;
            utils.merge(this.session_stream.$, args[0], {delete_nulls:true})
        },
        "stream_settings_update_values": (...args) => {
            if (!this.session) return;
            utils.merge(this.session.$.stream_settings, args[0], {delete_nulls:true})
        },
        "restart_targets": (...args) => {
            return this.session_stream.restart_targets(...args)
        },
        "new_session": (...args) => {
            return this.new_session(...args)
        },
        "get_media_info": (...args) => {
            return this.get_media_info(...args)
        },
        "save_file": (...args) => {
            return this.save_file(...args)
        },
        "rearrange_sessions": (...args) => {
            return this.rearrange_sessions(...args)
        },
        "destroy_session": (...args) => {
            return this.destroy_session(...args)
        },
        "subscribe_session": (...args) => {
            return this.subscribe_session(...args)
        },
        "subscribe_sysinfo": (...args) => {
            return this.subscribe_sysinfo(...args)
        },
        "add_volume": (...args) => {
            return globals.app.ipc.request("file-manager", "add_volume", args)
        },
        "edit_volume": (...args) => {
            return globals.app.ipc.request("file-manager", "edit_volume", args)
        },
        "delete_volume": (...args) => {
            return globals.app.ipc.request("file-manager", "delete_volume", args)
        },
    }

    _init() {
        globals.app.$.clients[this.id] = this.$;
    }

    new_session(name) {
        var s = new InternalSession(null, name || globals.app.get_new_session_name());
        s.$.access_control[this.username] = {"access":"owner"};
        this.subscribe_session(s.id);
        return s.id;
    }
    
    async destroy_session(session_id, move_autosave_dir=true) {
        var s = globals.app.sessions[session_id];
        if (!s) return;
        if (move_autosave_dir && s.type === constants.SessionTypes.INTERNAL) {
            await s.move_autosave_dir();
        }
        await s.destroy();
    }

    rearrange_sessions(old_index, new_index) {
        var sessions = utils.sort(Object.values(globals.app.sessions), s=>s.$.index);
        utils.array_move_element(sessions, old_index, new_index);
        sessions.forEach((s,i)=>s.$.index = i);
    }

    subscribe_session(id) {
        var old_session = this.session;
        if (old_session) old_session.client_updater.unsubscribe(this);
        let session = globals.app.sessions[id];
        if (session) {
            session.client_updater.subscribe(this);
            this.$.session_id = session.id;
        } else {
            this.$.session_id = "";
        }
    }
    
    subscribe_sysinfo(value) {
        if (value) globals.app.sysinfo_client_updater.subscribe(this);
        else globals.app.sysinfo_client_updater.unsubscribe(this);
    }

    async save_file(file, data) {
        var fullpath = this.session.evaluate_and_sanitize_filename(file);
        if (fullpath) await utils.safe_write_file(fullpath, data, "utf-8");
    }

    get_media_info(filename, opts) {
        return globals.app.get_media_info(filename, opts);
    }

    _destroy() {
        delete globals.app.$.clients[this.id];
        return super._destroy();
    }
}

export default MainClient;