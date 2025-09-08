

export class Segment {
    title="";
    duration=0;
    uri="";
    data={};
    #str;

    constructor(str) {
        this.add(str);
    }

    add(str) {
        if (this.uri) {
            throw new Error(`Segment has concluded, cannot add: ${str}`);
        }
        var m;
        var lines = str.split(/\n/);
        for (var line of lines) {
            if (m = line.match(/^#EXTINF:(.+)$/)) {
                let extinfData = m[1].trim();
                const [durationStr, ...titleParts] = extinfData.split(',');
                const title = titleParts.join(',').replace(/"/g, '');
                this.duration = parseFloat(durationStr);
                this.title = title || null;
            } else if (m = line.match(/^#EXT-X-([^:]+):(.+)$/) || line.match(/^#EXT-X-([^:]+)$/)) {
                var [_, key, value] = m;
                if (value === undefined) value = true;
                else {
                    let dict = {};
                    for (let pair of value.split(",")) {
                        let [k,v] = pair.split("=");
                        try {
                            dict[k] = JSON.parse(v);
                        } catch (e) {
                            dict[k] = v;
                        }
                    }
                    value = dict;
                }
                this.data[key] = value;
            } else if (line) {
                this.uri = line;
            }
        }
    }
    
    toString() {
        if (!this.#str) {
            this.#str = "";
            if (this.duration) {
                this.#str += `#EXTINF:${this.duration.toFixed(6)},${this.title || ""}\n`;
            }
            for (var k in this.data) {
                var v = this.data[k];
                if (typeof v == "boolean" && v) {
                    this.#str += `#EXT-X-${k}\n`;
                } else if (typeof v == "object" && v !== null) {
                    this.#str += `#EXT-X-${k}:${Object.entries(v).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(",")}\n`;
                } else {
                    this.#str += `#EXT-X-${k}:${v}\n`;
                }
            }
            this.#str += `${this.uri}\n`;
        }
        return this.#str;
    }
}
