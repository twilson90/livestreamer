import upath from "upath";
import path from "node:path";
import Mime from "mime";
import fs from "fs-extra";
import stream from "node:stream";
import * as constants from "../../core/constants.js";
import Driver from "../Driver.js";

/**
 * @inheritDoc
 */
class LocalFileSystem extends Driver {
	__abspath(id_or_path) {
		return upath.join(this.volume.root, id_or_path);
	}
	__config(config) {
		config.separator = "/";
		config.root = upath.resolve(config.root);
	}
	__destroy() { }
	async __init() {
		var stat = await fs.stat(this.volume.root).catch(()=>{});
		if (!stat || !stat.isDirectory()) {
			console.error(`LocalFileSystem Volume '${this.volume.config.name}' does not exist.`);
			return false;
		}
		return true;
	}
	async __fix_permissions(id) {
		var p = this.abspath(id);
		var stat = await fs.stat(p).catch(()=>{});
		if (!stat) return;
		var is_dir = stat.isDirectory();
		
		if (this.volume.config.dir_mode && is_dir) {
			await fs.chmod(p, String(this.volume.config.dir_mode));
		} else if (this.volume.config.file_mode && !is_dir) {
			await fs.chmod(p, String(this.volume.config.file_mode));
		}
		if (this.volume.config.uid && this.volume.config.gid) {
			await fs.chown(p, this.volume.config.uid, this.volume.config.gid);
		}
	}
	__uri(id) {
		var p = this.abspath(id);
		if (!p.startsWith("/")) p = "/"+p;
		return new URL(p, "file://").toString();
	}
	async __upload(tmpfile, dirid, name) {
		var dstid = upath.join(dirid, name);
		await fs.move(tmpfile, this.abspath(dstid));
		return dstid;
	}
	async __stat(id) {
		if (this.cache.stats[id]) return this.cache.stats[id];
		return this.cache.stats[id] = (async()=>{
			id = String(id);

			let abspath = this.abspath(id);
			let is_root = abspath === this.abspath("/");
			let stat;
			
			try { stat = await fs.lstat(abspath).catch(()=>null); } catch { } // needed because windows emoji bug

			let name = "", parent = "", mime = null, size = 0, ts = 0, readable = false, writable = false;

			if (stat) {
				name = is_root ? this.volume.name : upath.basename(id);
				parent = upath.dirname(id);
				size = stat ? stat.size : 0;
				ts = stat ? Math.floor(stat.mtime.getTime() / 1000) : 0;
				
				readable = await fs.access(abspath, fs.constants.R_OK).then(()=>true).catch((e)=>false);
				writable = await fs.access(abspath, fs.constants.W_OK).then(()=>true).catch((e)=>false);
				let symlink = stat && stat.isSymbolicLink();
				if (symlink) {
					let lpath = await fs.readlink(abspath);
					lpath = path.resolve(abspath, lpath); // resolves relative symlinks
					let lstat = await fs.stat(lpath).catch(()=>null);
					if (!lstat) {
						mime = "symlink-broken";
						readable = writable = true;
					}
				}
				if (stat.isDirectory() || is_root) mime = constants.DIRECTORY;
				else mime = Mime.getType(id);
			}
			
			return { name, parent, mime, size, ts, readable, writable };
		})();
	}
	async __readdir(id) {
		var items = await fs.readdir(this.abspath(id)).catch(()=>[]);
		return items.map((item)=>upath.join(id, item));
	}
	async __move(srcid, dirid, name) {
		var dstid = upath.join(dirid, name);
		await fs.move(this.abspath(srcid), this.abspath(dstid));
		return dstid;
	}
	async __rename(src, name) {
        var dst = upath.join(upath.dirname(src), name);
        await fs.rename(this.abspath(src), this.abspath(dst));
		return dst;
	}
	async __copy(src, dst, name) {
		dst = upath.join(dst, name);
		await fs.copy(this.abspath(src), this.abspath(dst));
		return dst;
	}
	async __chmod(src, mode) {
		await fs.chmod(this.abspath(src), mode);
		return src;
	}
	async __rm(id) {
		var abspath = this.abspath(id);
		var stat = await fs.lstat(abspath).catch(()=>null);
		if (stat.isDirectory()) await fs.rm(abspath, {recursive:true});
		else await fs.unlink(abspath);
	}
	async __read(id, options) {
		return fs.createReadStream(this.abspath(id), options);
	}
	async __write(dirid, name, data) {
		var dst = upath.join(dirid, name);
		if (data instanceof stream.Readable) {
			var writable = fs.createWriteStream(this.abspath(dst));
			data.pipe(writable);
			this.on("abort", ()=>writable.destroy("aborted"));
			await new Promise((resolve,reject)=>{
				writable.on("close", resolve);
				writable.on("error", reject);
			});
		} else {
			await fs.writeFile(this.abspath(dst), data);
		}
		return dst;
	}
	async __mkdir(dirid, name) {
		var dst = upath.join(dirid, name);
		await fs.mkdir(this.abspath(dst), {recursive:true});
		return dst;
	}
}

export default LocalFileSystem;