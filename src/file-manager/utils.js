import path from "node:path";
import stream from "node:stream";
import crypto from "node:crypto";
import fs from "node:fs";
import MultiStream from "multistream";
import { Writable } from "node:stream";

export function suffix(name, suff) {
	var ext = path.extname(name);
	var fil = path.basename(name, ext);
	return fil + suff + ext;
}
export function getExt(filename) {
	return filename.match(/\.[^.]+$/)[0];
}
export function replaceExt(filename, ext) {
	if (getExt(filename)) return filename.replace(/\.[^.]+$/, ext);
	if (!ext.startsWith(".")) ext = "."+ext;
	return filename+ext;
}
export function isSubdir(parent, dir) {
	const relative = path.relative(parent, dir);
	return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
export function tryRequire(dir, name) {
	dir = path.resolve(dir);
	if (!isSubdir(dir, name)) return;
	try { return require(path.resolve(dir, name)) } catch {};
}
/** @param {stream.Stream} stream @returns {Buffer} */
export function streamToBuffer(stream) {
	return new Promise((resolve, reject) => {
		let buffers = [];
		stream.on('error', reject);
		stream.on('data', (data)=>buffers.push(data));
		stream.on('end', ()=>resolve(Buffer.concat(buffers)));
	});
}
export function md5(str) {
	return crypto.createHash("md5").update(str).digest("hex");
}
/** @param {Readable[]} inputs @param {Writable} output */
export async function mergefiles(inputs, output) {
	// var fd;
	if (typeof output === "string") {
		// fd = fs.openSync(output, 'w+');
		output = fs.createWriteStream(output, {flags:"w+"});
	}
	inputs = inputs.map((input) => {
		if (typeof input === "string") return fs.createReadStream(input);
		return input;
	});
	return new Promise((resolve, reject) => {
		var stream = new MultiStream(inputs);
		stream.pipe(output);
		stream.on('end', () => {
			// if (fd) fs.closeSync(fd);
			resolve(true);
		});
		stream.on('error', (e) => {
			// if (fd) fs.closeSync(fd);
			reject(false);
		});
	});
}