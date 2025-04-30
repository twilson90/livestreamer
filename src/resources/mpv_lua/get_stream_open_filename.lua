local msg = require 'mp.msg'
local utils = require("mp.utils")
local options = require("mp.options")

local o = {
   try_ytdl_first = false,
   ytdl_path = "",
}
options.read_options(o, "ytdl_hook")

local hook
if o.try_ytdl_first then
   hook = "on_load"
else
   hook = "on_load_fail"
end

mp.add_hook(hook, 50, function ()
    local json = utils.format_json(mp.get_property_native("stream-open-filename"))
    msg.info(json)
end)