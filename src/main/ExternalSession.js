import {globals, utils, SessionTypes, Session, SessionProps, Session$} from "./exports.js";

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
        var name = nms_session.publishArgs["name"] || `[${ip}]`;
        var id = nms_session.publishStreamPath.split("/").pop();

        super(SessionTypes.EXTERNAL, new ExternalSession$(), utils.get_defaults(SessionProps), id, name);

        this.$.client_ip = ip;

        this.nms_session = nms_session;
        
        this.$.stream_settings.targets = globals.app.parse_targets(nms_session.publishArgs["targets"]);
        
        this.start_stream();

        this.stream.on("stopped", ()=>{
            this.destroy();
        });
    }
}

export default ExternalSession;