import path from "node:path";
import fs from "fs-extra";
import events from "node:events";
import readline from "node:readline";
import net from "node:net";
import cron from "node-cron";
import os from "node:os";
import { glob } from "glob";
import http_proxy from "http-proxy";
import http from "node:http";
import https from "node:https";
import child_process, { ChildProcess } from "node:child_process";
import { program } from 'commander';
import chokidar from "chokidar";
import { fileURLToPath } from "node:url";
import Logger from "./Logger.js";
import IPC from "./IPC.js";
import * as utils from "./utils.js";
import globals from "./globals.js";
import config_default from "./config.default.js";
import {minimatch} from "minimatch";
/** @typedef {typeof import("./config.default.js").default & typeof import("../file-manager/config.default.js").default & typeof import("../media-server/config.default.js").default & typeof import("../main/config.default.js").default} Conf */

const pm2 = async (func, ...args)=>{
    var _pm2 = (await import("pm2")).default;
    return utils.promisify(_pm2[func].apply(_pm2, args));
};

const dirname = import.meta.dirname;
const root = (path.basename(dirname) === "core") ? path.dirname(dirname) : dirname;
console.log("root:", root);

program
    .name('Live Streamer')
    .description('Live Streamer CLI')
    // .version(pkg.version);

program
    .option(`-m --modules --module [string...]`, "Module paths", [])
    .option(`-c --configs --config [string...]`, "Config paths", [])

program.parse();

// import pkg from "./package.json" with { type: "json" };

export class Core extends events.EventEmitter {
    modules = {}; // just a map of name:path to dir
    ppid = process.ppid;
    /** @type {Logger} */
    logger;
    #app;
    #auth;
    #is_master = false;
    #shutdown = false;
    /** @type {cron.ScheduledTask} */
    #compress_logs_cron;
    /** @type {http.Server} */
    #proxy_http_server;
    /** @type {https.Server} */
    #proxy_https_server;
    /** @type {(http.Server | https.Server)[]} */
    #servers = [];
    /** @type {Record<PropertyKey,ChildProcess>} */
    #subprocesses = {};
    /** @type {{modules:string[],configs:{string}[],config:{Conf}[]}} */
    #opts = {};
    /** @type {string[]} */
    #conf_paths = [];
    /** @type {Conf} */
    conf = {};
    
    #portable = fs.existsSync("portable");
    get portable() { return !!(process.env.LIVESTREAMER_PORTABLE ?? this.#portable ?? false) };
    get debug() { return !!(process.env.LIVESTREAMER_DEBUG ?? this.conf["core.debug"] ?? false); }
    get is_electron() { return !!(process.versions['electron']); }
    get use_pm2() { return !!("pm_id" in process.env || this.conf["core.use_pm2"]); }
    get auth() { return this.#auth; }
    
    async init(name, app, master_opts) {
        this.name = name || "livestreamer";
        this.#app = app;
        this.#is_master = !!master_opts;
        this.#opts = Object.assign({}, program.opts(), typeof master_opts === "object" ? master_opts : null);
        return this.ready = this.#init();
    }
    
    resolve_module(m) {
        var _resolve = (m)=>{
            if (!fs.existsSync(m)) return;
            if (fs.statSync(m).isDirectory()) m = glob.sync(`${m}/index.{js,ts,cjs,mjs}`)[0];
            if (minimatch(path.basename(m), `*.{js,ts,cjs,mjs,cts,mts}`)) return path.resolve(m);
        };
        return _resolve(m) ?? _resolve(path.join(root, m));
    }

    async #init() {
        this.logger = new Logger(this.name, {stdout:true, file:true, prefix:this.#is_master?"":this.name});
        this.logger.console_adapter();
        this.appspace = process.env.LIVESTREAMER_APPSPACE || "livestreamer";
        
        this.assets_dir = path.resolve(root, "assets");
        this.cwd = process.cwd();

        let modules = [
            ...new Set(
                [
                    ...(process.env.LIVESTREAMER_MODULES ? [process.env.LIVESTREAMER_MODULES] : []),
                    ...this.#opts.modules
                ]
                    .flatMap(p=>p.split(path.delimiter))
                    .map(p=>this.resolve_module(p))
            )
        ];
        console.info(modules);

        process.env.LIVESTREAMER_MODULES = modules.join(path.delimiter); // necessary for child processes.
        this.modules = Object.fromEntries(modules.map(p=>[path.basename(path.dirname(p)), p]));
        console.info(this.modules);
        
        var exit_handler = async ()=>{
            await this.shutdown();
            process.exit(0);
        };
        process.on('beforeExit', exit_handler);
        process.on('SIGINT', exit_handler);
        process.on('SIGTERM', exit_handler);
        process.on('unhandledRejection', (e) => {
            // is this a good idea?
            this.logger.error(`Unhandled Rejection:`, e);
        });
        process.on('message', async (packet)=>{
            if (packet === "shutdown") {
                await this.shutdown();
                process.exit(0);
            }
        });

        var appdata_dir;
        if (process.env.LIVESTREAMER_APPDATA_DIR) {
            appdata_dir = process.env.LIVESTREAMER_APPDATA_DIR;
        } else if (this.portable) {
            appdata_dir = "appdata";
        } else {
            appdata_dir = path.join(utils.is_windows() ? process.env.PROGRAMDATA : "/var/opt/", this.appspace);
        }
        this.appdata_dir = path.resolve(appdata_dir);
        this.tmp_dir = path.resolve(appdata_dir, "tmp");
        this.logs_dir = path.resolve(appdata_dir, "logs");
        this.cache_dir = path.resolve(appdata_dir, "cache");
        this.clients_dir = path.resolve(appdata_dir, "clients");
        this.conf_path = path.resolve(appdata_dir, "config.json");
        this.files_dir = path.resolve(appdata_dir, "files");
        this.saves_dir = path.resolve(appdata_dir, "saves");
        this.targets_dir = path.resolve(appdata_dir, "targets");
        this.screenshots_dir = path.resolve(appdata_dir, "screenshots");
        this.socket_dir = path.join(this.tmp_dir, "socks");

        if (this.#is_master) {
            await fs.mkdir(this.appdata_dir, { recursive: true });
            await fs.mkdir(this.tmp_dir, { recursive: true });
            await fs.mkdir(this.logs_dir, { recursive: true });
            await fs.mkdir(this.cache_dir, { recursive: true });
            await fs.mkdir(this.clients_dir, { recursive:true });
            await fs.mkdir(this.files_dir, { recursive:true });
            await fs.mkdir(this.saves_dir, { recursive:true });
            await fs.mkdir(this.targets_dir, { recursive:true });
            await fs.mkdir(this.screenshots_dir, { recursive:true });
            await fs.mkdir(this.socket_dir, { recursive:true });
            await this.#cleanup_sockets();
        }
        this.ipc_socket_path = this.get_socket_path(`ipc`);
        this.ipc = new IPC(this.#is_master, this.name, this.ipc_socket_path);

        /* if (process.env.LIVESTREAMER_DOCKER) {
            if (this.#is_master) {
                this.ipc.on("internal:log", (log)=>this.logger.log_to_stdout(log));
            } else {
                this.logger.on("log", (log)=>this.ipc.emit("internal:log", log));
            }
        } */

        if (this.#is_master) {
            this.ipc.on("core:module_restart", (m)=>this.module_restart(m));
            this.ipc.on("core:module_start", (m)=>this.module_start(m));
            this.ipc.on("core:module_stop", (m)=>this.module_stop(m));
            
            for (let m of Object.values(this.modules)) {
                let conf_path = path.join(m, "..", "config.default.js");
                if (await fs.exists(conf_path)) {
                    this.#conf_paths.push(conf_path);
                } else {
                    console.warn(`'${conf_path}' does not exist.`)
                }
            }
            if (process.env.LIVESTREAMER_CONF_PATH) this.#conf_paths.push(process.env.LIVESTREAMER_CONF_PATH);
            if (this.#opts.configs) {
                this.#conf_paths.push(...this.#opts.configs);
            }

            this.#conf_paths.push(...await glob("config.*"));
            let conf_watcher = chokidar.watch([...this.#conf_paths], {awaitWriteFinish:true});
            conf_watcher.on("change", async()=>{
                console.info("Conf was updated.");
                await this.#load_conf();
            });
        } else {
            this.ipc.on("core:update-conf", async ()=>{
                this.#load_conf();
            });
        }

        await this.#load_conf();
        
        this.logger.info(`Initializing ${this.name} [${this.#is_master?"MASTER":"FORK"}]...`);
        this.logger.info(`  cwd: ${this.cwd}`);
        this.logger.info(`  appdata: ${this.appdata_dir}`);
        if (utils.has_root_privileges()) {
            this.logger.info(`  root: true`);
        } else {
            this.logger.warn(`  root: false (Without root privileges some functionality will be limited.)`);
        }

        this.stdin_listener = readline.createInterface(process.stdin);
        this.stdin_listener.on("line", (line)=>{
            var parts = utils.split_spaces_exclude_quotes(line);
            this.emit("input", parts);
        });

        if (this.#is_master) {
            await this.#setup_proxies();
            await this.#compress_logs();
            this.#compress_logs_cron = cron.schedule(this.conf["core.compress_logs_schedule"], ()=>this.#compress_logs());
            if (this.use_pm2) {
                await pm2("connect", true);
            }
            for (let m in this.modules) {
                this.module_start(m);
            }
        }
        if (this.#app && this.#app.init) await this.#app.init();
        await this.ipc.connect();
    }

    async module_start(m) {
        if (this.#is_master) {
            this.logger.info(`Starting ${m}...`);
            var script_path = this.modules[m];
            var node_args = [];
            if (this.debug && this.conf[`${m}.inspect`]) {
                node_args.push(`--inspect=${this.conf[`${m}.inspect`]}`);
            }
            if (core.use_pm2) {
                /** @type {pm2.StartOptions} */
                var p = {
                    "max_restarts": 5,
                    "name": `${this.appspace}.${m}`,
                    "script": script_path,
                    "autorestart": true,
                    "restart_delay": 5000,
                    "node_args": node_args,
                    // "cron_restart" : null // prevent inheriting
                };
                return pm2("start", p);
            } else {
                if (!this.#subprocesses[m]) {
                    let p;
                    // p = child_process.spawn("node", [...node_args, script_path]);
                    p = child_process.fork(script_path, {execArgv: node_args, stdio: ["ignore", "inherit", "inherit", "ipc"] });
                    p.on("error", (err)=>{
                        console.error(err);
                    });
                    this.#subprocesses[m] = p;
                }
            }
        } else {
            this.ipc.emit("core:module_start", m);
        }
    }

    async module_restart(m) {
        if (this.#is_master) {
            if (core.use_pm2) {
                returnpm2("restart", `${this.appspace}.${m}`);
            } else {
                await this.module_stop(m);
                await this.module_start(m);
            }
        } else {
            this.ipc.emit("core:module_restart", m);
        }
    }

    async module_stop(m) {
        if (this.#is_master) {
            this.logger.info(`Stopping ${m}...`);
            if (core.use_pm2) {
                return pm2("stop", `${this.appspace}.${m}`);
            } else {
                if (this.#subprocesses[m]) {
                    var p = this.#subprocesses[m];
                    delete this.#subprocesses[m];
                    await utils.tree_kill(p.pid)
                }
            }
        } else {
            this.ipc.emit("core:module_stop", m);
        }
    }

    get_socket_path(sock_name) {
        return utils.is_windows() ? `\\\\.\\pipe\\${this.appspace}_${sock_name}` : path.join(this.socket_dir, `${sock_name}.sock`);
    }

    async #cleanup_sockets() {
        if (utils.is_windows()) return;
        await fs.emptyDir(this.socket_dir);
    }
    
    async #setup_proxies() {
        const agent = new http.Agent({
            maxSockets: Number.MAX_SAFE_INTEGER,
            keepAlive: true,
            keepAliveMsecs: 30 * 1000
        });
        const proxies = {};
        console.info(`Starting HTTP Server on port ${this.conf["core.http_port"]}`);

        /** @param {http.IncomingMessage} req @param {string} name */
        var get_proxy = (req)=>{
            var url = new URL(req.url, "http://localhost");
            var parts = url.pathname.slice(1).split("/");
            var name = parts[0];
            /** @type {http_proxy} */
            var proxy, target;
            // for some reason this adds a big delay to any request... can't figure it out
            if (this.ipc.get_process(name)) {
                req.url = "/"+parts.slice(1).join("/") + url.search;
                if (!proxies[name]) {
                    proxies[name] = http_proxy.createProxy({ agent });
                    proxies[name].on("error", (e)=>{
                        console.warn(e);
                    })
                }
                proxy = proxies[name];
                target = { socketPath: this.get_socket_path(`${name}_http`) };
            }
            return { proxy, target };
        }
        /** @type {(req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => void} */
        const handle_upgrade = (req, socket, head)=>{
            var { proxy, target } = get_proxy(req);
            if (!proxy) {
                socket.end();
                return;
            }
            proxy.ws(req, socket, head, {
                xfwd: true,
                target
            });
        };
        /** @param {Request} req @param {Response} res */
        const request_listener = async (req, res)=>{
            // if (http and https is available) {
            //   res.redirect("https://" + req.headers.host + req.path);
            // }
            if (req.url == "/favicon.ico") {
                let f = path.join(this.assets_dir, "icon.ico");
                res.writeHead(200, { 'Content-Type': "image/x-icon" });
                res.end(await fs.readFile(f));
                return;
            }
            let {proxy,target} = get_proxy(req);
            if (proxy) {
                proxy.web(req, res, {
                    xfwd: true,
                    target
                });
                return;
            }
            res.statusCode = 500;
            res.end();
        };
        if (this.conf["core.http_port"]) {
            this.#proxy_http_server = http.createServer(request_listener);
            this.#proxy_http_server.listen(this.conf["core.http_port"]);
            this.#servers.push(this.#proxy_http_server);
        }
        var certs = await this.#get_certs();
        if (this.conf["core.https_port"] && certs) {
            console.info(`Starting HTTPS Server on port ${this.conf["core.https_port"]}`);
            this.#proxy_https_server = https.createServer(certs, request_listener);
            this.#proxy_https_server.listen(this.conf["core.https_port"]);
            this.#servers.push(this.#proxy_https_server);
            setInterval(async ()=>{
                var certs = await this.#get_certs();
                if (certs) this.#proxy_https_server.setSecureContext(certs);
            }, 1000*60*60*24*7) // every week
        }

        for (var s of this.#servers) {
            s.keepAliveTimeout = (60 * 1000);
            s.headersTimeout = (60 * 1000);
            s.on('upgrade', handle_upgrade);
        }
    }

    async #get_certs(){
        try { return { key: await fs.readFile(this.conf["core.ssl_key"]), cert: await fs.readFile(this.conf["core.ssl_cert"]) }; } catch {}
    }

    async #compress_logs() {
        await utils.compress_logs_directory(this.logs_dir);
        this.ipc.emit("compress_logs");
    }

    async #load_conf() {
        utils.clear(this.conf);
        if (this.#is_master) {
            Object.assign(this.conf, config_default);
            for (let conf_path of this.#conf_paths) {
                if (await fs.exists(conf_path)) {
                    let conf_json = (await utils.import(conf_path)).default;
                    for (var k in conf_json) {
                        this.conf[k] = conf_json[k];
                    }
                }
            }
            if (this.#opts.config) {
                Object.assign(this.conf, this.#opts.config);
            }
        } else {
            Object.assign(this.conf, JSON.parse(await fs.readFile(this.conf_path, "utf-8")));
        }
        this.use_https = !!(this.conf["core.https_port"] && (await this.#get_certs()));
        this.http_url = `http://${this.conf["core.hostname"]}:${this.conf["core.http_port"]}`;
        this.https_url = `https://${this.conf["core.hostname"]}:${this.conf["core.https_port"]}`;
        this.url = this.use_https ? this.https_url : this.http_url;
        this.#auth = this.conf["core.auth"] ? (await utils.import(this.conf["core.auth"])) : null;
        if (this.#is_master) {
            await fs.writeFile(this.conf_path, JSON.stringify(this.conf));
            this.ipc.emit("core:update-conf", this.conf);
        }
    }

    /** @return {{user_id:number,username:string,email:string,is_admin:boolean}} */
    async authorise(req, res) {
        if (this.#auth) {
            try {
                return this.#auth.login(req, res);
            } catch (e) {
                console.error("authorise error", e);
                return false;
            }
        } else {
            return {
                user_id: 0,
                username: "default",
                email: "",
                is_admin: true,
                // display_name: this.user.display_name,
            };
        }
    }

    async unauthorise(req, res) {
        if (this.#auth) {
            try {
                return this.#auth.logout(req, res);
            } catch (e) {
                console.error("unauthorise error", e);
                return false;
            }
        }
        return true;
    }

    set_priority(pid, pri) {
        try {
            if (pid) os.setPriority(pid, pri);
            else os.setPriority(pri);
        } catch (e) {
            this.logger.warn(`Could not set process priority for pid: ${pid||process.pid}`);
        }
    }

    // #get_inspect() {
    //     var argv = process.argv;
    //     if (this.#pm2_description) {
    //         argv = this.#pm2_description.pm2_env.node_args || this.#pm2_description.pm2_env.interpreter_args;
    //     }
    //     var inspect_arg = argv.find(a=>a.match(/^--inspect(-)?/)) || "";
    //     var inspect_hostname = "127.0.0.1";
    //     var inspect_port = 9229;
    //     var inspect_host = inspect_arg.split("=")[1] || `${inspect_hostname}:${inspect_port}`;
    //     if (inspect_host.match(/^[^:]+:\d+$/)) [inspect_hostname, inspect_port] = inspect_host.split(":");
    //     else inspect_hostname = inspect_host || inspect_hostname;
    //     return [inspect_hostname, +inspect_port];
    // }

    async shutdown() {
        if (this.#shutdown) return;
        this.#shutdown = true;
        console.info("Handling shutdown...");
        this.emit("destroy");
        if (this.#app && this.#app.destroy) await this.#app.destroy();
        if (this.#is_master) {
            console.log("Signalling child processes to shutdown.");
            for (var p of Object.values(this.#subprocesses)) {
                p.send("shutdown");
            }
            await Promise.all(Object.values(this.#subprocesses).map(p=>new Promise(r=>p.on("exit", r))));
            console.log("Done.");
        }
        await this.ipc.destroy();
    }
}

export const core = globals.core = new Core();
export default core;