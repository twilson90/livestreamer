local msg = require 'mp.msg'
local utils = require("mp.utils")
mp.add_hook("on_load", 50, function ()
   local json = utils.format_json(mp.get_property_native("stream-open-filename"))
   msg.info(json)
end)