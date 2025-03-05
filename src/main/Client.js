import fs from "fs-extra";
import * as utils from "../core/utils.js";
import ClientBase from "../core/ClientBase.js";
import InternalSession from "./InternalSession.js";
import globals from "./globals.js";

export class Client extends ClientBase {
    get session() { return globals.app.sessions[this.$.session_id]; }
    get stream() { return this.session.stream; }
    get sessions() { return globals.app.sessions; }
    get app() { return globals.app; }
    get core() { return globals.app; }

    _init() {
        globals.app.$.clients[this.id] = this.$;
        var session_id = this.url.searchParams.get("session_id");
        if (session_id) this.attach_to(session_id);
        var $ = utils.json_copy(globals.app.$, (k, v)=>{
            if (v === globals.app.$.sessions) {
                return Object.fromEntries(Object.entries(v).map(([k,s])=>{
                    return [k, utils.deep_filter(s, globals.app.SESSION_PUBLIC_PROPS)];
                }));
            }
            return v;
        });
        $.conf = {
            // ["auth"]: globals.app.auth,
            ["debug"]: globals.app.debug,
            ["test_stream_low_settings"]: globals.app.conf["main.test_stream_low_settings"],
            ["rtmp_port"]: globals.app.conf["media-server.rtmp_port"],
            ["session_order_client"]: globals.app.conf["main.session_order_client"],
        };
        $.hostname = globals.app.hostname;
        this.send({ $ });
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
        // if (this.session) this.session.emit("detach", this);
        if (!globals.app.sessions[session_id]) session_id = null;
        this.$.session_id = session_id;
        var session = this.session;
        var $ = {session:(session)?session.$:{[utils.Observer.RESET_KEY]:"Object"}};
        this.send({$});
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

export default Client;