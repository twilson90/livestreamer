/** @param {string} filename @param {string} text */
export function download(filename, text) {
    var element = document.createElement('a');
    element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    element.download = filename;
    element.click();
}

export default download;