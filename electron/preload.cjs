const electron = require("electron");

var expose_map = {};
/** @param {string} name */
var expose = (name)=>{
    var parts = name.split(".")
    var target = expose_map;
    var p = parts.shift();
    while (parts.length) {
        target = target[p] = target[p] ?? {};
        p = parts.shift();
    }
    target[p] = (...args)=>electron.ipcRenderer.invoke("request", [name, args])
};

[
    "electron.dialog.showOpenDialog",
    "electron.dialog.showSaveDialog",
    "electron.shell.showItemInFolder",
    "electron.shell.openExternal",
].forEach(expose);

expose_map.electron.getPathForFile = electron.webUtils.getPathForFile;

for (var k in expose_map) {
    electron.contextBridge.exposeInMainWorld(k, expose_map[k]);
}
// electron.contextBridge.exposeInMainWorld("config", {});