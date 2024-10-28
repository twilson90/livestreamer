import * as utils from "../core/utils.js";
import SessionBase from "./SessionBase.js";

export class ExternalSession extends SessionBase {
    nms_session;
    get stream_key() { return this.nms_session ? this.nms_session.publishStreamPath.split("/")[2] : null; }
    get appname() { return this.nms_session ? this.nms_session.appname : null; }
    get publishStreamPath() { return this.nms_session ? this.nms_session.publishStreamPath : null; }
    
    constructor(nms_session) {
        var ip = utils.is_ip_local(nms_session.ip) ? "::1" : nms_session.ip;
        var name = nms_session.publishArgs["name"] || `[${ip}]`;
        var id = nms_session.publishStreamPath.split("/").pop();

        super(id, name);

        this.$.client_ip = ip;
        // this.$.nms_session_id = nms_session.id;

        this.nms_session = nms_session;
        
        this.$.stream_settings["method"] = "rtmp";
        this.$.stream_settings["targets"] = (nms_session.publishArgs["targets"] || "").split(",");
        
        this.start_stream();

        this.stream.on("stopped", ()=>{
            this.destroy();
        });
    }
}

export default ExternalSession;