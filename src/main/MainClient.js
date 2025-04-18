import fs from "fs-extra";
import {globals, utils, InternalSession, Client, Client$} from "./exports.js";

export class MainClient$ extends Client$ {
    session_id = "";
}

/** @extends {Client<MainClient$>} */
export class MainClient extends Client {
    get session() { return globals.app.sessions[this.$.session_id]; }
    get stream() { return this.session.stream; }
    get sessions() { return globals.app.sessions; }
    get app() { return globals.app; }
    get core() { return globals.app; }

    oninit() {
        globals.app.$.clients[this.id] = this.$;
    }

    new_session() {
        var s = new InternalSession();
        s.$.access_control[this.username] = {"access":"owner"};
        this.attach_to(s.id);
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

    attach_to(session_id) {
        if (this.$.session_id == session_id) return;
        if (this.session) this.session.emit("detach", this);
        if (!globals.app.sessions[session_id]) session_id = null;
        this.$.session_id = session_id;
        if (this.session) this.session.emit("attach", this);
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