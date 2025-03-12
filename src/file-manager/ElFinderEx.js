import {ElFinder, Volume} from "./exports.js";

/** @typedef {{name:string, isdir:boolean, children:TreeNode[]}} TreeNode */

export class ElFinderEx extends ElFinder {
    async init() {
        this.commands.add("listtree");
        /**
         * @param {object} opts
         * @param {string[]} opts.targets
         * @param {boolean} opts.download
         * @param {express.Response} res
         */
        Volume.prototype.listtree = async function(opts, res) {
            return this.driver(opts.reqid, async (driver)=>{
                var targets = opts.targets.map(t=>driver.unhash(t).id);
                var ids = [];
                for (var target of targets) {
                    await driver.walk(target, (id, stat, parents=[])=>{
                        ids.push(id)
                    });
                }
                return { ids };
            });
        }

    }
}
export default ElFinderEx;