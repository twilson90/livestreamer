import {WindowCommunicator} from "../../utils/dom/WindowCommunicator.js";
import {mime_ext_map} from "../../utils/mime_ext_map.js";
import {md5} from "../../utils/md5.js";
import "./extra-style.scss";

export class FileManagerWebApp {
	constructor() {
		this.init();
	}
	async init() {
		var is_iframe = window.self !== window.top;
		var params = new URLSearchParams(window.location.search);
		let opts;
		try { opts = JSON.parse(params.get("opts")); } catch {}
		if (!opts) opts = {};
		var hash = window.location.hash.slice(5);
		if (!is_iframe) window.history.replaceState({}, "", "/"+window.location.hash);
		console.log(opts);
		var id = opts ? opts.id : null;
		console.log("id:", id)
		// var key = params.get("key");
		// var parent_window = window.opener || window.parent;
		
		var original_rename = elFinder.prototype.commands.rename;
		elFinder.prototype.commands.copy = function() {
			original_rename.apply(this, arguments);
			var old_getstate = this.getstate;
			this.getstate = function(select) {
				var sel = this.files(select);
				if (sel.some(f=>f.isroot)) return 0;
				return old_getstate.call(this, [select]);
			};
		};
		
		elFinder.prototype.commands.quit = function() {
			this.exec = function() {
				messenger.request(window.parent, "exit", {id});
			};
			this.getstate = function(select) {
				return 0;
			};
		}
		elFinder.prototype.commands.quit.prototype = { forceLoad: true };
		elFinder.prototype.i18.en.messages['cmdquit'] = 'Quit';

		elFinder.prototype.commands.downloadtree = function() {
			this.exec = function(hashes) {
				var dfds = hashes.map(hash=>{
					return this.fm.request({
						data : {cmd : 'listtree', targets : [hash]},
						notify : {type : 'listtree', cnt : hashes.length, hideCnt : hashes.length==1, msg : `Traversing file tree...`},
						cancel : true,
						preventDefault : true,
					})
				});
				return $.when(...dfds).done((...datas)=>{
					var lines = [];
					for (var i = 0; i < datas.length; i++) {
						for (var id of datas[i].ids) {
							lines.push(id);
						}
						if (i < datas.length-1) lines.push("-".repeat(64));
					}
					var text = lines.join(`\r\n`);
					var filename = `${hashes.map(h=>this.fm.file(h).name).join(", ")}.txt`;
					var file = new File([text], filename, {type:"text/plain;charset=utf-8"});
					saveAs(file);
				});
			};
			this.getstate = function(hashes) {
				var files = this.files(hashes);
				return (files.length && files.every(f=>f.mime==="directory")) ? 0 : -1;
			};
		}
		elFinder.prototype.commands.downloadtree.prototype = { forceLoad: true };
		elFinder.prototype.i18.en.messages['cmddownloadtree'] = 'Download tree listing';

		var defaultOpts = {
			url : "./api",
			// cssAutoLoad : false,
			ui : ['toolbar', 'tree', 'path', 'stat'], /* 'places', */
			uiOptions: {
				toast : {
					defaults : {}
				},
				toolbar:[
					['home'],
					// ['netmount'],
					['back', 'reload', 'forward'],
					['mkdir', 'mkfile', 'upload'],
					['open', 'download', 'info', 'quicklook'],
					['copy', 'cut', 'paste', 'rm', 'duplicate', 'rename', 'edit'],
					['extract', 'archive'],
					['search'],
					['view', 'sort'],
					['preference', 'help'],
				],
				toolbarExtra: {
					defaultHides: [],
				},
				dialog:{
					focusOnMouseOver: false,
				},
				tree: {
					durations : {
						slideUpDown : 0.2,
						autoScroll : 0.2,
					}
				},
				cwd: {
					showSelectCheckboxUA: ['All']
				},
			},
			contextmenu : {
				// navbarfolder menu
				navbar : ['open', '|', 'copy', 'cut', 'paste', 'duplicate', '|', 'rm', '|', 'rename', 'info', 'downloadtree', '|', 'netunmount'],
				// current directory menu
				cwd    : ['reload', 'back', '|', 'upload', 'mkdir', 'mkfile', 'paste', '|', 'sort', '|', 'info', 'downloadtree', '|', 'netunmount'],
				// current directory file menu
				files  : ['open', 'quicklook', '|', 'download', '|', 'copy', 'cut', 'paste', 'duplicate', '|', 'rm', '|', 'edit', 'rename', '|', 'archive', 'extract', '|', 'info', 'downloadtree', '|', 'netunmount']
			},
			// These name are 'size', 'aliasfor', 'path', 'link', 'dim', 'modify', 'perms', 'locked', 'owner', 'group', 'perm' and your custom info items label
			hideItems : ['aliasfor'],
			resizable: false,
			noResizeBySelf: true,
			height: "100%",
			useBrowserHistory: !is_iframe,
			enableAlways: true,
			uploadMaxChunkSize: 16 * 1024 * 1024,
			showFiles : 512,
			// selectHashes: params.get("selectHashes"),
			// startPathHash: params.get("startPathHash"),
			// showThreshold : 50,
			commandsOptions : {
				info: {
					showHashAlgorisms: []
				},
				edit : {
					extraOptions : {
						// set API key to enable Creative Cloud image editor
						// see https://console.adobe.io/
						creativeCloudApiKey : '',
						// browsing manager URL for CKEditor, TinyMCE
						// uses self location with the empty value
						managerUrl : ''
					}
				},
				quicklook : {
					// autoplay : true,
					// jplayer  : 'extensions/jplayer'

					// to enable CAD-Files and 3D-Models preview with sharecad.org
					sharecadMimes : ['image/vnd.dwg', 'image/vnd.dxf', 'model/vnd.dwf', 'application/vnd.hp-hpgl', 'application/plt', 'application/step', 'model/iges', 'application/vnd.ms-pki.stl', 'application/sat', 'image/cgm', 'application/x-msmetafile'],
					// to enable preview with Google Docs Viewer
					googleDocsMimes : ['application/pdf', 'image/tiff', 'application/vnd.ms-office', 'application/msword', 'application/vnd.ms-word', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/postscript', 'application/rtf'],
					// to enable preview with Microsoft Office Online Viewer
					// these MIME types override "googleDocsMimes"
					officeOnlineMimes : ['application/vnd.ms-office', 'application/msword', 'application/vnd.ms-word', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation']
				}
			},
			// bootCalback calls at before elFinder boot up 
			bootCallback : function(fm, extraObj) {
				var elem = fm.getUI()[0];
				fm.resources.blink = function(elm, mode) {
					var acts = {
						slowonce : function(){elm.hide().delay(250).fadeIn(750).delay(500).fadeOut(3500);},
						lookme   : function(){elm.show().fadeIn(250);}
					}, func;
					mode = mode || 'slowonce';
					func = acts[mode] || acts['lookme'];
					elm.stop(true, true);
					func();
				}

				var quit_button = $(`<button class="quit" title="Quit"><i class="fas fa-xmark"></i></button>`)[0];
				quit_button.onclick = ()=>{
					messenger.request(window.parent, "exit", {id});
				};

				/* any bind functions etc. */
				fm.bind('open sync select toolbarpref', function() {
					elem.classList.remove("elfinder-touch");
					elem.classList.remove("elfinder-mobile");
				});
				var add_quit_button = ()=>{
					if (!is_iframe) return;
					if (quit_button.parentElement) return;
					var toolbar = elem.querySelector(".elfinder-toolbar");
					if (toolbar) toolbar.prepend(quit_button);
				}
				
				// for example set document.title dynamically.
				var title = document.title;
				var last_cwd;
				
				var toolbar_observer = new MutationObserver((mutations)=>{
					add_quit_button();
				}).observe(elem, {childList: true, subtree: true});
				add_quit_button();

				/* var netmounts;
				try { netmounts = JSON.parse(localStorage.getItem("fm:netmounts")); } catch {}
				if (!netmounts) netmounts = {}; */

				/* var register_netmount = (key, data)=>{
					if (data) {
						let {protocol, host, user, pass, port, path} = data;
						netmounts[key] = {protocol, host, user, pass, port, path};
					} else {
						delete netmounts[key];
					}
					localStorage.setItem("fm:netmounts", JSON.stringify(netmounts));
				}; */

				/* for (var k in netmounts) {
					let {protocol, host, user, pass, port, path} = netmounts[k];
					fm.request({data: {cmd: "netmount", protocol, host, user, pass, port, path}});
				}

				var old_request = fm.request;
				fm.request = function(...args) {
					var {data} = args[0];
					if (data?.cmd == "netmount") {
						fm.one('netmountdone', function(...args) {
							if (data?.protocol == "unmount") {
								rm.reload()
							}
						});
					}
					return old_request.apply(this, args);
				} */
				
				fm.bind('open', function() {
					var path = '', cwd = fm.cwd();
					if (!last_cwd) last_cwd = cwd;
					if (cwd.hash !== hash) {
						fm.bind('cwdrender', function() {
							if (!hash) return;
							requestAnimationFrame(()=>{
								var top = Number.MAX_SAFE_INTEGER;
								var highest_elem;
								var $item = fm.cwdHash2Elm(hash);
								hash = null;
								if ($item[0]) {
									if ($item[0].offsetTop < top) {
										top = $item[0].offsetTop;
										highest_elem = $item[0];
									}
									var e = $.Event("click");
									$item.trigger(e);
									if (highest_elem) {
										setTimeout(()=>highest_elem.scrollIntoView({block:"center"}, 100));
									}
									fm.enable();
								}
							});
						});
						return;
					}
					if (cwd) {
						path = fm.path(cwd.hash) || null;
					}
					// document.title = path ? path + ' - ' + title : title;
					document.title = `File Manager - ${path}`;
					last_cwd = cwd;
				}).bind('destroy', function() {
					document.title = title;
				});
			},
		};
		// opts = (await messenger.request(parent_window, "elfinder_options", id));
		// console.log("elfinder_options received:", opts);
		if (Array.isArray(opts.fileFilter)) {
			var fileFilter = opts.fileFilter;
			opts.fileFilter = (file)=>{
				for (var type of fileFilter) {
					if (mime_ext_map[type].some(ext=>file.name.toLowerCase().endsWith(ext.toLowerCase()))) return true;
				}
				return false;
			}
		}

		var messenger = new WindowCommunicator();
		if (opts.getFileCallback === true) {
			opts.getFileCallback = (files)=>{
				if (!Array.isArray(files)) files = [files];
				messenger.request(window.parent, "files", {files, id})
			};
		}
		opts = $.extend(true, defaultOpts, opts);
		console.log(opts);
		if (opts.getFileCallback) {
			opts.contextmenu.files.unshift('getfile', '|');
			opts.uiOptions.toolbar.push(['getfile']);
		}

		if (is_iframe) {
			// opts.uiOptions.toolbar.push(['quit']);
		}
		
		$('#elfinder').elfinder(opts);
	}
}
export default FileManagerWebApp;