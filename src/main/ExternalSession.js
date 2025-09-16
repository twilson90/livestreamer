import {globals, Session, SessionProps, Session$} from "./exports.js";
import {utils, constants} from "../core/exports.js";

class ExternalSession$ extends Session$ {
    client_ip = "";
}

/** @extends {Session<ExternalSession$>} */
export class ExternalSession extends Session {
    nms_session;
    get stream_key() { return this.nms_session ? this.nms_session.publishStreamPath.split("/")[2] : null; }
    get appname() { return this.nms_session ? this.nms_session.appname : null; }
    get publishStreamPath() { return this.nms_session ? this.nms_session.publishStreamPath : null; }
    
    constructor(nms_session) {
        var ip = utils.is_ip_local(nms_session.ip) ? "::1" : nms_session.ip;
        var id = nms_session.publishStreamPath.split("/").pop();
        var name = nms_session.publishArgs["name"] || `[${ip}]`;

        super(`${id}`, new ExternalSession$(), constants.SessionTypes.EXTERNAL, utils.get_defaults(SessionProps));
        
        this.$.name = name;

        this.nms_session = nms_session;
        
        this.$.client_ip = ip;
        this.$.publish_stream_path = nms_session.publishStreamPath;
        this.$.stream_settings.test = ("test" in nms_session.publishArgs);
        this.$.stream_settings.targets = (nms_session.publishArgs["targets"]||"").split(/,\s*/).map(s=>s.trim()).filter(t=>t);
        this.$.stream_settings.target_opts = utils.try_catch(()=>JSON.parse(nms_session.publishArgs["target_opts"]));
    }

    async start_stream(opts) {
        var res = await super.start_stream(opts);
        if (res) {
            this.stream.on("stopped", ()=>{
                globals.app.ipc.request("media-server", "stop_session", [this.nms_session.id]);
                this.destroy();
            });
        }
        return res;
    }
}

export default ExternalSession;