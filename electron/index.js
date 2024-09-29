import {core, utils} from "@livestreamer/core";
import squirrel from 'electron-squirrel-startup';
import esMain from 'es-main';
import electron from "electron";
import path from "node:path";
import child_process from "node:child_process";
import fs from "fs-extra";
import url from 'node:url';
import net from "node:net";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrel) {
    electron.app.quit();
}

const __dirname = import.meta.dirname;
electron.app.commandLine.appendSwitch('ignore-certificate-errors');
electron.app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

class ElectronApp {
    constructor() {
        // this.main_public_html_dir = path.join(core.root_dir, "lib/main/public_html");
        /* electron.ipcMain.on('get_conf', (event)=>{
            event.returnValue = core.conf;
        }); */
        
        /* electron.ipcMain.on('ondragstart', (event, file_path) => {
          event.sender.startDrag({
            file: path.join(__dirname, file_path),
            // icon: iconName
          })
        }); */

        electron.protocol.registerSchemesAsPrivileged([
            {
                scheme: "app",
                privileges: {
                    standard: true,
                    secure: true,
                    allowServiceWorkers: true,
                    supportFetchAPI: true,
                    // corsEnabled: options.isCorsEnabled,
                },
            }
        ]);

        const partition = "";

        /* var proxy = http_proxy.createProxy({
            maxSockets: Number.MAX_SAFE_INTEGER,
            keepAlive: true,
            keepAliveMsecs: 30 * 1000
        }) */
        
        electron.app.whenReady().then(()=>{
            // const session = partition ? electron.session.fromPartition(options.partition) : electron.session.defaultSession;
            // session.protocol.handle("app", async (req)=>{
            //     var {host, pathname} = new URL(req.url);
            //     if (host == "main") {
            //         // var d = await req.json();
            //         // console.log(d);
            //         // net.connect(target).(d);
            //         // var p = path.join(main.public_html_dir, ...pathname.slice(1).split("/"));

            //         /* var res = await new Promise((resolve,reject)=>{
            //             var res = new Response();
            //             req.connection = {};
            //             proxy.web(req, res, {
            //                 xfwd: true,
            //                 target
            //             }, (err)=>{
            //                 if (err) reject(err);
            //                 else resolve(res);
            //             });
            //         });
            //         return res; */

            //         /* core.get_socket_path(`main_http`);
            //         proxy.ws(req, socket, head, {
            //             xfwd: true,
            //             target
            //         });
            //         if (await fs.exists(p)) {
            //             return electron.net.fetch(url.pathToFileURL(p));
            //         } */
            //         /* return new Response('bad', {
            //           status: 400,
            //           headers: { 'content-type': 'text/html' }
            //         }) */
            //     }
            // });
            // /** @param {Request} req */
            // var websocket_handler = (req)=>{
                
            // };
            // session.protocol.handle("ws", websocket_handler);
            // session.protocol.handle("wss", websocket_handler);

        
            electron.ipcMain.handle('request', async (event, request)=>{
                var request = Array.isArray(request) ? request : [request];
                var [fn, args] = request;
                var result = undefined;
                try {
                    result = eval(fn);
                } catch (e) {
                    console.log(e);
                }
                if (typeof result === "function") result = result.apply(null, args);
                result = await Promise.resolve(result);
                return result;
            });

            electron.app.on('activate', ()=>{
                // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
                if (Electron.BrowserWindow.getAllWindows().length === 0) this.create_window();
            });
            this.create_window();
        })

        // Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
        electron.app.on('window-all-closed', function () {
            if (process.platform !== 'darwin') {
                electron.app.quit();
            }
        });

        electron.app.once('before-quit', async (e)=>{
            e.preventDefault();
            electron.app.quit();
        });

        var menu = electron.Menu.buildFromTemplate([
            {
                label: 'Menu',
                submenu: [
                    { type: 'separator' },
                    {
                        label:'Save All', 
                        accelerator: 'CommandOrControl+Alt+S',
                        click: ()=>{
                            core.ipc.send("main", "main.save-sessions");
                        }
                    },
                    { type: 'separator' },
                    {
                        label:'Exit',
                        accelerator: 'CommandOrControl+W',
                        click: ()=>electron.app.quit()
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    {
                        label:'Reload', 
                        accelerator: 'CommandOrControl+R',
                        click: ()=>this.window.reload()
                    },
                    {
                        label:'Toggle Developer Tools',
                        accelerator: 'CommandOrControl+Shift+I',
                        click: ()=>this.window.webContents.toggleDevTools()
                    }
                ],
            },
            /* {
                label: 'Other',
                submenu: [
                    {
                        label:'Open Installation Folder', 
                        click: ()=>exec_start(this.app_dir),
                    },
                ],
            }, */
        ]);

        electron.Menu.setApplicationMenu(menu);
    }

    init() {
        
    }

    async create_window() {
        await core.ready;
        await core.ipc.wait_for_process("main");

        this.window = new electron.BrowserWindow({
            width: 1280,
            height: 720,
            minHeight: 300,
            minWidth: 500,
            title: 'Live Streamer',
            icon: "icon.png",
            // show: 
            // show: false,
            webPreferences: {
                preload: path.resolve(__dirname, "preload.cjs"),
                // webSecurity: false,
                nodeIntegration: true,
                // contextIsolation: false,
                // enableRemoteModule: true,
                // nodeIntegration: true,
                devTools: true,
                // nativeWindowOpen: true,
            }
        });
        if (core.debug) this.window.webContents.openDevTools();

        /* this.window.webContents.on('new-window', (e, url) => {
            if (url.match(/^https?:\/\//)) {
                e.preventDefault();
                open(url);
            } else if (url.match(/^file:\/\//)) {
                e.preventDefault();
                // window.webContents.send('blocked-new-window', url);
            }
        }); */
        /* this.window.webContents.setWindowOpenHandler(({ url }) => {
            if (url === 'about:blank') {
                return {
                    action: 'allow',
                    // overrideBrowserWindowOptions: {
                    //     frame: false,
                    //     fullscreenable: false,
                    //     backgroundColor: 'black',
                    //     webPreferences: {
                    //         preload: 'my-child-window-preload-script.js'
                    //     }
                    // }
                }
            }
            return { action: 'deny' }
        }); */
        // this.window.loadFile(path.join(this.main_public_html_dir, "index.html"));
        // this.window.loadURL("app://");
        // var url = `http://localhost:${core.conf["core.http_port"]}/main/index.html`;
        // console.log(url);
        // this.window.loadURL(`app://main/index.html`);
        
        this.window.loadURL(`http://localhost:8120/main/index.html`);

        var t0 = Date.now(), t1;
        this.window.webContents.on('did-finish-load', ()=>{
            t0 = Date.now();
        })
        this.window.webContents.on('dom-ready', ()=>{
            t1 = Date.now();
            console.log("Dom ready in", t1-t0, "ms");
        });
    }
}

function exec_start(app, args) {
    child_process.exec(`start "" "${app}"`);
}

const app = new ElectronApp();
core.init("electron", app, 
    utils.is_main(import.meta)
        ? {
            modules:[
                "modules/media-server",
                "modules/main"
            ]
        }
        : false
    );

export default app;