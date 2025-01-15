import squirrel from 'electron-squirrel-startup';
import electron from "electron";
import path from "node:path";
import net from "node:net";
import globals from "../core/globals.js";

const dirname = import.meta.dirname;

/** @type {electron.BrowserWindow} */
var window;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrel) {
    electron.app.quit();
}

if (electron.app) {
    electron.app.commandLine.appendSwitch('ignore-certificate-errors');
    electron.app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

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

    // this.main_public_html_dir = path.join(this.root_dir, "lib/main/public_html");
    /* electron.ipcMain.on('get_conf', (event)=>{
        event.returnValue = this.conf;
    }); */

    /* electron.ipcMain.on('ondragstart', (event, file_path) => {
    event.sender.startDrag({
        file: path.join(__dirname, file_path),
        // icon: iconName
    })
    }); */

    // Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
    electron.app.on('window-all-closed', function () {
        console.log("electron.app.window-all-closed");
        if (process.platform !== 'darwin') {
            console.log("electron.app.quit");
            electron.app.quit();
        }
    });

    electron.app.once('before-quit', async (e)=>{
        e.preventDefault();
        await globals.core.shutdown();
        console.log("electron.app.quit");
        electron.app.quit();
    });

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

        //         /* this.get_socket_path(`main_http`);
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
        
        globals.core.ready.then(()=>{
            // const session = electron.session.defaultSession;
            // session.protocol.handle("http", async (req)=>{
            //     var res = new Response();
            //     await globals.core.web_request_listener(req, res);
            //     return res;
            // });
            // /** @param {Request} req */
            // var websocket_handler = async (req)=>{
            //     var res = new Response();
            //     await globals.core.ws_upgrade_handler(req, res);
            //     return res;
            // };
            // session.protocol.handle("ws", websocket_handler);
            // session.protocol.handle("wss", websocket_handler);
        })

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

        if (process.platform === 'darwin') {
            electron.app.on('activate', ()=>{
                // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
                create_window();
            });
        } else {
            create_window();
        }

        var menu = electron.Menu.buildFromTemplate([
            {
                label: 'Menu',
                submenu: [
                    { type: 'separator' },
                    {
                        label:'Save', 
                        accelerator: 'CommandOrControl+S',
                        click: ()=>{
                            globals.core.ipc.send("main", "main.save-sessions");
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
                        click: ()=>window.reload()
                    },
                    {
                        label:'Toggle Developer Tools',
                        accelerator: 'CommandOrControl+Shift+I',
                        click: ()=>window.webContents.toggleDevTools()
                    }
                ],
            },
            {
                label: 'Other',
                submenu: [
                    {
                        label:'Open Installation Folder', 
                        click: ()=>electron.shell.openPath(globals.core.appdata_dir),
                    },
                ],
            },
        ]);

        electron.Menu.setApplicationMenu(menu);

        async function create_window() {
            if (electron.BrowserWindow.getAllWindows().length > 0) {
                return;
            }
            console.log("Creating Window");
            window = new electron.BrowserWindow({
                width: 1280,
                height: 720,
                minHeight: 300,
                minWidth: 500,
                title: 'Live Streamer',
                icon: "icon.png",
                // show: false,
                webPreferences: {
                    preload: path.resolve(dirname, "preload.cjs"),
                    nodeIntegration: true
                    // webSecurity: false,
                    // contextIsolation: false,
                    // enableRemoteModule: true,
                    // nodeIntegration: true,
                    // nativeWindowOpen: true,
                }
            });
            await globals.core.ready;
            if (globals.core.debug) window.webContents.openDevTools();
            window.loadURL(globals.core.get_urls("main").url);
        }
    });
}