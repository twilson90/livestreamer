const electron = require("electron");

electron.contextBridge.exposeInMainWorld("electron", {
    "showOpenDialog": (...args)=>electron.ipcRenderer.invoke("showOpenDialog", args),
    "showSaveDialog": (...args)=>electron.ipcRenderer.invoke("showSaveDialog", args),
    "showItemInFolder": (...args)=>electron.ipcRenderer.invoke("showItemInFolder", args),
    "openExternal": (...args)=>electron.ipcRenderer.invoke("openExternal", args),
    "getPathForFile": (file)=>electron.webUtils.getPathForFile(file),
});