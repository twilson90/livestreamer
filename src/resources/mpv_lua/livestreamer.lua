local msg = require("mp.msg")
local utils = require("mp.utils")
local unpack = unpack or table.unpack

local props = {}
-- local volume = 100
-- local volume_speed = 1

mp.enable_messages("info")

local JSON = {}

JSON.stringify = function(t)
    local json, error = utils.format_json(t)
    return json
end

JSON.parse = function(t)
    local data, error = utils.parse_json(t)
    return data
end

function observe_property(k, cb)
    props[k] = mp.get_property_native(k)
    mp.observe_property(k, "native", function(k, v)
        props[k] = v
        cb(k, v)
    end)
end

function register_script_message(name, cb)
    mp.register_script_message(name, function(json)
        local args = JSON.parse(json)
        cb(unpack(args))
    end)
end

------------------

--[[ for _,k in ipairs({
    "stream-open-filename",
    "path",
    "audio-pts",
    "eof-reached",
    "playback-abort"
}) do
    observe_property(k, function(k, v)
        msg.info(k..": "..JSON.stringify(v))
    end)
end ]]

-- observe_property("stream-open-filename")

--[[ register_script_message("set_volume", function(v, m, speed)
    volume = v * m
    volume_speed = speed
end) ]]

local discontinuity_pts = nil
local on_load_commands = nil
local on_load_opts = nil

-- attempts to overcome significant audio discontinuity (which results in playback being reset) by seeking to the last known discontinuity pts and resuming playback
observe_property("audio-pts", function(_,v)
    -- msg.info("audio-pts: "..tostring(v).." discontinuity_pts: "..tostring(discontinuity_pts))
    if v == nil and discontinuity_pts then
        msg.info("audio discontinuity detected, attempting seek to new PTS: "..tostring(discontinuity_pts).."...")
        mp.commandv("seek", discontinuity_pts, "absolute")
        discontinuity_pts = nil
    end
end)

register_script_message("setup_loadfile", function(_on_load_opts, _on_load_commands)
    on_load_opts = _on_load_opts
    on_load_commands = _on_load_commands
end)


mp.register_event("log-message", function(e)
    if e.level == "warn" then
        local m = e.text:match("^Invalid audio PTS:")
        if m then
            t1,t2 = e.text:match("^Invalid audio PTS: ([%d%.]+) %-> ([%d%.]+)")
            msg.info("audio discontinuity detected, "..t1.." -> "..t2)
            discontinuity_pts = tonumber(t2)
        end
    end
end)

mp.add_hook("on_before_start_file", 50, function ()
end)

mp.add_hook("on_load", 50, function ()
    discontinuity_pts = nil
    mp.set_property("keep-open", "always") -- have to set it here because 'encoding' auto-profile will always change this to 'no' ...
    mp.set_property_native("keep-open-pause", false)
    if props.o then
        mp.set_property("framedrop", "vo")
    end
end)

mp.add_hook("on_preloaded", 50, function ()
    if on_load_commands then
        msg.info("on_load_commands: "..JSON.stringify(on_load_commands))
        for _,c in ipairs(on_load_commands) do
            local _,err = pcall(function()
                mp.commandv(unpack(c))
            end)
            msg.info(err)
        end
    end
    if on_load_opts then
        msg.info("on_load_opts: "..JSON.stringify(on_load_opts))
        for k,v in pairs(on_load_opts) do
            mp.set_property_native("file-local-options/"..k, v)
        end
    end

    --[[ local tracklist = mp.get_property_native("track-list")
    for _, track in ipairs(tracklist) do
        msg.info("track: "..tostring(track.type).." | "..tostring(track.title).." | "..tostring(track.id))
        if track.type == "sub" and track.title == "__fades__" then
            mp.set_property_native("file-local-options/sid", track.id)
        end
    end ]]
end)

mp.add_hook("on_load_fail", 50, function ()
end)

--[[ mp.add_hook("on_load", 9, function ()
    local url = mp.get_property("stream-open-filename", "")
    ytdl = true
    if url:match "^rtmp://" then
        ytdl = false
    end
    mp.set_property_native('ytdl', ytdl)
end) ]]

-- this prevents mpv from unloading encoder at the end of the playlist
-- local e_reason
-- mp.register_event("end-file", function(e)
--     e_reason = e.reason
-- end)
-- mp.add_hook("on_after_end_file", 50, function ()
--     local valid_eof_reasons = {eof=1,error=1,unknown=1}
--     if not loading and valid_eof_reasons[e_reason] then
--         on_load_commands = nil
--         on_load_opts = nil
--         mp.commandv("loadfile", "null://eof", "replace")
--     end
-- end)
-----------------------------------------------------------------------

mp.add_hook("on_unload", 50, function ()
end)

--[[ mp.add_periodic_timer(1.0/30.0, function()
    mp.get_time()
end) ]]

--[[ mp.add_periodic_timer(1.0, function()
    local path = mp.get_property_native("path")
    local pts = mp.get_property_native("audio-pts")
    if path ~= "null://eof" and pts == nil then
        mp.commandv("loadfile", "null://eof", "replace")
    end
end) ]]