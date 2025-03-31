/** @param {string} url */
export function fetch(url) {
    return new Promise((resolve) => {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                resolve(xhr.responseText);
            }
        };
        xhr.open("GET", url, true);
        xhr.send();
    });
}

export default fetch;