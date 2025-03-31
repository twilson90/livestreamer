/** @param {string} contentType @param {boolean} multiple */
export function upload(contentType, multiple = false) {
    return new Promise(resolve => {
        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        input.accept = contentType;
        input.onchange = () => {
            let files = [...input.files];
            if (multiple) resolve(files);
            else resolve(files[0]);
        };
        input.click();
    });
}

export default upload;