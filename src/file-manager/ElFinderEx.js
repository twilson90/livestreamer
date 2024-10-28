import ElFinder from "./ElFinder.js";
import Volume from "./Volume.js";

/** @typedef {{name:string, isdir:boolean, children:TreeNode[]}} TreeNode */

export class ElFinderEx extends ElFinder {
    async init() {
        await super.init();
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
                // var trees = [];
                // for (var target of targets) {
                //     /** @type {Object.<string,TreeNode>} */
                //     var nodes = {};
                //     nodes[target] = {name:this.name, isdir:true};
                //     await driver.walk(target, (id, stat, parents=[])=>{
                //         var parent = parents[parents.length-1];
                //         var isdir = stat.mime===constants.DIRECTORY;
                //         var name = stat.name;
                //         nodes[id] = {name, isdir};
                //         if (parent) {
                //             if (!nodes[parent].children) nodes[parent].children = [];
                //             nodes[parent].children.push(nodes[id]);
                //         }
                //         return nodes[id];
                //     });
                //     trees.push(nodes[target]);
                // }
                // var trees = [];
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