import fs from "fs-extra";
import * as utils from "../core/utils.js";
import ClientBase from "../core/ClientBase.js";
import InternalSession from "./InternalSession.js";
import globals from "./globals.js";

export class Client extends ClientBase {
    get session() { return globals.app.sessions[this.$.session_id]; }
    get sessions() { return globals.app.sessions; }
    get app() { return globals.app; }
    get core() { return globals.app; }

    init() {
        globals.app.$.clients[this.id] = this.$;
        var session_id = this.url.searchParams.get("session_id");
        if (session_id) this.attach_to(session_id);
        var $ = utils.deep_copy(globals.app.$);
        $.conf = {
            // ["auth"]: globals.app.auth,
            ["debug"]: globals.app.debug,
            ["media-server.name"]: globals.app.conf["media-server.name"],
            ["media-server.rtmp_port"]: globals.app.conf["media-server.rtmp_port"],
            ["session_order_client"]: globals.app.conf["session_order_client"],
        };
        this.send({ $ });
    }

    new_session() {
        var s = new InternalSession();
        s.$.access_control[this.username] = {"access":"owner"}
        this.attach_to(s.id);
    }

    rearrange_sessions(old_index, new_index) {
        var sessions = utils.sort(Object.values(globals.app.sessions), s=>s.$.index);
        utils.array_move(sessions, old_index, new_index);
        sessions.forEach((s,i)=>s.$.index = i);
    }

    attach_to(session_id) {
        if (this.$.session_id == session_id) return;
        // if (this.session) this.session.emit("detach", this);
        if (!globals.app.sessions[session_id]) session_id = null;
        this.$.session_id = session_id;
        // if (this.session) this.session.emit("attach", this);
    }

    async save_file(dir, file, data) {
        var fullpath = await globals.app.evaluate_filename(dir, file).catch(e=>globals.app.logger.error(e.message));
        if (fullpath) await fs.writeFile(fullpath, data);
    }
    destroy() {
        super.destroy();
        delete globals.app.$.clients[this.id];
    }
}

export default Client;