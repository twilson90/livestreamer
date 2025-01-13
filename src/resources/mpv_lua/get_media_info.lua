local msg = require 'mp.msg'
local utils = require("mp.utils")
mp.add_hook("on_preloaded", 50, function()
   local json = utils.format_json({
      ["duration"] = mp.get_property_native("duration"),
      ["track-list"] = mp.get_property_native("track-list")
   })
   msg.info(json)
end)