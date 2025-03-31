/** @param {string} s */

export function string_to_bytes(s) {
	var m = s.match(/[a-z]+/i);
	var num = parseFloat(s);
	var e = 1;
	var unit = m[0] || "";
	if (m = unit.match(/^ki(bi)?/i)) e = 1024;
	else if (m = unit.match(/^k(ilo)?/i)) e = 1000;
	else if (m = unit.match(/^mi(bi)?/i)) e = Math.pow(1024, 2);
	else if (m = unit.match(/^m(ega)?/i)) e = Math.pow(1000, 2);
	else if (m = unit.match(/^gi(bi)?/i)) e = Math.pow(1024, 3);
	else if (m = unit.match(/^g(iga)?/i)) e = Math.pow(1000, 3);
	else if (m = unit.match(/^ti(bi)?/i)) e = Math.pow(1024, 4);
	else if (m = unit.match(/^t(era)?/i)) e = Math.pow(1000, 4);
	else if (m = unit.match(/^pi(bi)?/i)) e = Math.pow(1024, 5);
	else if (m = unit.match(/^p(eta)?/i)) e = Math.pow(1000, 5);
	unit = unit.slice(m ? m[0].length : 0);
	if (unit.match(/^b(?!yte)/)) num /= 8; // important lower case, uppercase B means byte usually;
	return num * e;
}

export default string_to_bytes;