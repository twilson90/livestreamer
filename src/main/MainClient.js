import fs from "fs-extra";
import {globals, utils, InternalSession, Client, Client$} from "./exports.js";

export class MainClient$ extends Client$ {
    session_id = "";
    stream_id = "";
}

/** @extends {Client<MainClient$>} */
export class MainClient extends Client {
    get session() { return globals.app.sessions[this.$.session_id]; }
    /** @type {InternalSession} */
    get internal_session() { return this.session; }
    get stream() { return this.session.stream; }

    api = {
        ...super.api,
        "analyze_local_file_system_volume": (...args)=>globals.app.analyze_local_file_system_volume(...args),
        "module_restart": (...args)=>globals.app.module_restart(...args),
        "module_stop": (...args)=>globals.app.module_stop(...args),
        "module_start": (...args)=>globals.app.module_start(...args),
        "create_target": (...args)=>globals.app.create_target(...args),
        "update_target": (...args)=>globals.app.update_target(...args),
        "delete_target": (...args)=>globals.app.delete_target(...args),
        // "delete_font": (...args)=>globals.app.delete_font(...args),
        // "get_font": (...args)=>globals.app.get_font(...args),
        "session_update_values": (...args)=>this.session.update_values(...args),
        "session_handover": (...args)=>this.internal_session.handover(...args),
        "session_get_autosave_history": (...args)=>this.internal_session.get_autosave_history(...args),
        "session_detect_crop": (...args)=>this.internal_session.detect_crop(...args),
        "stop_stream": (...args)=>this.internal_session.stop_stream(...args),
        "start_stream": (...args)=>this.internal_session.start_stream(...args),
        "reload_current_item": (...args)=>this.internal_session.reload_current_item(...args),
        "set_player_default_override": (...args)=>this.internal_session.set_player_default_override(...args),
        "update_media_info_from_ids": (...args)=>this.internal_session.update_media_info_from_ids(...args),
        "playlist_add": (...args)=>this.internal_session.playlist_add(...args),
        "playlist_remove": (...args)=>this.internal_session.playlist_remove(...args),
        "playlist_update": (...args)=>this.internal_session.playlist_update(...args),
        "playlist_undo": (...args)=>this.internal_session.playlist_undo(...args),
        "playlist_redo": (...args)=>this.internal_session.playlist_redo(...args),
        "download_and_replace": (...args)=>this.internal_session.download_and_replace(...args),
        "cancel_download": (...args)=>this.internal_session.cancel_download(...args),
        "cancel_upload": (...args)=>this.internal_session.cancel_upload(...args),
        "playlist_play": (...args)=>this.internal_session.playlist_play(...args),
        "seek": (...args)=>this.internal_session.seek(...args),
        "update_volume": (...args)=>this.internal_session.update_volume(...args),
        "load_session": (...args)=>this.internal_session.load(...args),
        "load_session_autosave": (...args)=>this.internal_session.load_autosave(...args),
        "get_user_save_data": (...args)=>this.internal_session.get_user_save_data(...args),
        "pause": (...args)=>this.stream.pause(...args),
        "stream_update_values": (...args)=>this.stream.update_values(...args),
        "restart_stream": (...args)=>this.stream.restart_stream(...args),
        "subscribe": (...args)=>this.subscribe(...args),
        "new_session": (...args)=>this.new_session(...args),
        "get_media_info": (...args)=>this.get_media_info(...args),
        "save_file": (...args)=>this.save_file(...args),
        "rearrange_sessions": (...args)=>this.rearrange_sessions(...args),
        "destroy_session": (...args)=>this.destroy_session(...args),
        "subscribe_session": (...args)=>this.subscribe_session(...args),
    }

    oninit() {
        globals.app.$.clients[this.id] = this.$;
    }

    new_session() {
        var s = new InternalSession();
        s.$.access_control[this.username] = {"access":"owner"};
        this.subscribe_session(s.id);
        return s.id;
    }
    
    async destroy_session(session_id, move_autosave_dir=true) {
        var s = globals.app.sessions[session_id];
        if (!s) return;
        if (move_autosave_dir) {
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
        session.client_updater.subscribe(this);
        this.$.session_id = session.id;
    }
    
    subscribe_sysinfo(value) {
        if (value) globals.app.sysinfo_client_updater.add_client(this);
        else globals.app.sysinfo_client_updater.remove_client(this);
    }

    async save_file(file, data) {
        var fullpath = this.session.evaluate_and_sanitize_filename(file);
        if (fullpath) await fs.writeFile(fullpath, data);
    }

    get_media_info(filename, opts) {
        return globals.app.get_media_info(filename, opts);
    }

    ondestroy() {
        delete globals.app.$.clients[this.id];
        return super.ondestroy();
    }
}

export default MainClient;