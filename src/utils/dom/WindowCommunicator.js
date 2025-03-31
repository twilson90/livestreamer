export class WindowCommunicator {
    id = 0;
    requests = {};
    handlers = {};
    #on_message;
    /** @param {Window} _window */
    constructor(_window) {
        this.window = _window = _window || window;
        _window.addEventListener("message", this.#on_message = async (e) => {
            if (e.data.event === "request") {
                var { request, data, id } = e.data;
                var response;
                if (this.handlers[request]) {
                    await Promise.resolve(this.handlers[request](data, e.source)).then(r => response = r);
                    if (response !== undefined) {
                        var payload = { event: "response", response, id };
                        e.source.postMessage(payload, "*");
                    }
                }
            } else if (e.data.event === "response") {
                // console.log(e.data)
                var { id, response } = e.data;
                if (id in this.requests) {
                    this.requests[id](response);
                    delete this.requests[id];
                }
            }
        });
    }
    /** @param {string} request @param {function(any,Window):any} handler */
    on(request, handler) {
        this.handlers[request] = handler;
    }
    /** @param {Window} window */
    request(window, request, data, timeout = 10000) {
        var id = ++this.id;
        var payload = { event: "request", request, data, id };
        return new Promise((resolve, reject) => {
            this.requests[id] = (response) => {
                resolve(response);
            };
            window.postMessage(payload, "*");
            setTimeout(() => reject(`WindowCommunicator request ${id} timed out`), timeout);
        }).catch((e) => console.error(e));
    }

    destroy() {
        this.window.removeEventListener("message", this.#on_message);
    }
}

export default WindowCommunicator;