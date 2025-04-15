import {globals, utils, SessionTypes, Session, SessionProps, SessionPrivateProps, Session$, SessionPrivate$} from "./exports.js";

class ExternalSession$ extends Session$ {
    client_ip = "";
}

class ExternalSessionPrivate$ extends SessionPrivate$ {
    //..
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

        super(id, name, SessionTypes.EXTERNAL, new ExternalSession$(), SessionProps, new ExternalSessionPrivate$(), SessionPrivateProps);

        this.nms_session = nms_session;
        
        this.$.client_ip = ip;
        this.$_priv.stream_settings.test = ("test" in nms_session.publishArgs);
        this.$_priv.stream_settings.targets = (nms_session.publishArgs["targets"]||"").split(/,\s*/).map(s=>s.trim()).filter(t=>t);
        this.$_priv.stream_settings.target_opts = utils.try_catch(()=>JSON.parse(nms_session.publishArgs["target_opts"]));
        
        this.start_stream();

        this.stream.on("stopped", ()=>{
            this.destroy();
        });
    }
}

export default ExternalSession;