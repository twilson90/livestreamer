/** @typedef {{multiple:boolean, accept:string, directories:boolean}} FileDialogOptions */
/** @return {File[]} @param {FileDialogOptions} opts */
export function open_file_dialog(opts) {
    opts = Object.assign({}, opts);
    return new Promise((resolve) => {
        var element = document.createElement("input");
        element.style.display = 'none';
        element.type = "file";
        if (opts.accept) element.accept = opts.accept;
        if (opts.multiple) element.multiple = true;
        if (opts.directories) element.webkitdirectory = true;
        document.body.appendChild(element);
        element.addEventListener("change", function () {
            resolve([...this.files]);
        });
        element.dispatchEvent(new MouseEvent("click"));
        document.body.removeChild(element);
    });
}

export default open_file_dialog;