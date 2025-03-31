/** @param {File} file @param {Object} options */
export function read_file(file, options) {
    options = Object.assign({
        encoding: "utf-8",
    }, options);
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.addEventListener('load', (e) => {
            resolve(e.target.result);
        });
        reader.readAsText(file, options.encoding);
    });
}

export default read_file;