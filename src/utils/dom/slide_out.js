export function slide_out(elem, duration = 200) {
    var orig_height = elem.clientHeight;
    elem.style.height = `${orig_height}px`;
    var t0 = performance.now();
    var nf = ()=>{
        var t1 = performance.now();
        var p = Math.min(1, (t1 - t0) / duration);
        elem.style.height = `${Math.max(0, (1 - p) * orig_height)}px`;
        if (p < 1) requestAnimationFrame(nf);
    };
    requestAnimationFrame(nf);
}

export default slide_out;