local msg = require("mp.msg")
local utils = require("mp.utils")
mp.enable_messages("info")
--[[ mp.add_periodic_timer(1, function ()
    msg.info("estimated-frame-count: "..tostring(mp.get_property_native("estimated-frame-count")))
    msg.info("estimated-frame-number: "..tostring(mp.get_property_native("estimated-frame-number")))
    msg.info("estimated-vf-fps: "..tostring(mp.get_property_native("estimated-vf-fps")))
end) ]]

local frame_count = 0
local time_pos = 0
mp.observe_property("time-pos", "native", function(k, v)
    time_pos = v or 0
end)
mp.observe_property("video-frame-info", "native", function(k, v)
    frame_count = frame_count + 1
    vfps = frame_count / time_pos
    msg.info("t:"..tostring(time_pos).." f:"..tostring(frame_count).." vfps:"..tostring(vfps))
end)