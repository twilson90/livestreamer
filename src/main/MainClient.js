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

    _init() {
        globals.app.$.clients[this.id] = this.$;
        var session_id = this.url.searchParams.get("session_id");
        if (session_id) this.attach_to(session_id);
    }

    new_session() {
        var s = new InternalSession();
        s.$.access_control[this.username] = {"access":"owner"};
        this.attach_to(s.id);
    }

    rearrange_sessions(old_index, new_index) {
        var sessions = utils.sort(Object.values(globals.app.sessions), s=>s.$.index);
        utils.array_move_element(sessions, old_index, new_index);
        sessions.forEach((s,i)=>s.$.index = i);
    }

    attach_to(session_id) {
        if (this.$.session_id == session_id) return;
        if (!globals.app.sessions[session_id]) session_id = null;
        this.$.session_id = session_id;
        // if (this.session) this.session.emit("detach", this);
        /* var session = this.session;
        if (session) {
            var $ = {sessions:{[session_id]:session.$}, session_id};
            this.send({$});
        } */
        // if (this.session) this.session.emit("attach", this);
    }

    async save_file(file, data) {
        var fullpath = this.session.evaluate_and_sanitize_filename(file);
        if (fullpath) await fs.writeFile(fullpath, data);
    }

    destroy() {
        super.destroy();
        delete globals.app.$.clients[this.id];
    }
}

export default MainClient;