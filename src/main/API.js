import {program, Command} from "commander";
import fs from "fs-extra";
import {globals} from "./exports.js";
import {utils} from "../core/exports.js";

class CommandHack extends Command {
    #o = 0;
    _exit(){}
    outputHelp(...args) {
        if (this.#o) return;
        super.outputHelp(...args);
        this.#o++;
    }
    async parseAsync(args) {
        this.#o = 0;
        if (!args || !args.length) return;
        return await super.parseAsync(args, {from:"user"});
    }
}

// const log = (s)=>process.stdout.write(s+"\n", "utf8");

export class API {
    constructor() {}
    
    async parse(...args) {
        const program = new CommandHack();
      
        // Override exit to prevent process termination
        program
            .name('Main API')
        
        program.command("replace-filenames")
            .argument('<string>', 'find')
            .argument('<string>', 'replace')
            .action(/** @param {string} find @param {string} replace */ (find, replace)=>{
                var i = 0;
                /** @param {string} filename */
                let fix = (filename)=>{
                    var new_filename = filename.replace(find, replace);
                    if (new_filename != filename) {
                        console.log(`   ${filename} => ${new_filename}`);
                        i++;
                    }
                    return new_filename;
                }
                let props = ["subtitle_file", "audio_file", "background_file"];
                for (var session of Object.values(globals.app.sessions)) {
                    if (session.$.background_file) session.$.background_file = fix(session.$.background_file);
                    for (var item of Object.values(session.$.playlist)) {
                        item.filename = fix(item.filename);
                        for (var k of props) {
                            if (item.props[k]) item.props[k] = fix(item.props[k]);
                        }
                    }
                }
                console.log(`Replaced ${i} filenames.`);
                return;
            });
        
        program.command("replace-symlinks")
            .argument('<string>', 'dir')
            .argument('<string>', 'find')
            .argument('<string>', 'replace')
            .action(/** @param {string} dir @param {string} find @param {string} replace */ async (dir, find, replace)=>{
                var files = await utils.array_from_async_generator(utils.find_symlinks(dir, false));
                for (let f of files) {
                    let abspath = f.fullpath();
                    let old_linkpath = await f.readlink();
                    let new_linkpath = old_linkpath.replace(find, replace);
                    if (old_linkpath != new_linkpath) {
                        console.log(`${abspath} [${old_linkpath} => ${new_linkpath}]`);
                        await fs.unlink(abspath);
                        await fs.symlink(new_linkpath, abspath);
                    }
                }
            })
        
        program.command("remove-bad-symlinks")
            .argument('<string>', 'dir')
            .action(/** @param {string} dir */ async (dir)=>{
                var files = await utils.array_from_async_generator(utils.find_symlinks(dir, true));
                for (let f of files) {
                    let old_linkpath = await f.readlink();
                    console.log(`Deleting ${abspath} [${old_linkpath}]`);
                    await fs.unlink(f.fullpath());
                }
            })
        
        program.command("test")
            .action(()=>{
                console.log("Hello");
            })

  
        program
            .command('greet <name>')
            .description('Greet someone')
            .action((name) => {
                console.log(`Hello, ${name}!`);
            });
        
        await program.parseAsync(args);
    }
}
export default API;