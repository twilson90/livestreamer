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

function observe_property(k)
    props[k] = mp.get_property_native(k)
    mp.observe_property(k, "native", function(k, v)
        props[k] = v
    end)
end

function register_script_message(name, cb)
    mp.register_script_message(name, function(json)
        local args = JSON.parse(json)
        cb(unpack(args))
    end)
end

------------------

--[[ for _,v in ipairs({"volume", "track-list", "path", "o"}) do
    observe_property(v)
end ]]

-- observe_property("stream-open-filename")

--[[ register_script_message("set_volume", function(v, m, speed)
    volume = v * m
    volume_speed = speed
end) ]]

local on_load_commands = nil
local on_load_opts = nil
local loading = false
register_script_message("loadfile", function(filename, opts, _on_load_commands)
    loading = true
    on_load_commands = _on_load_commands
    on_load_opts = opts
    mp.commandv("loadfile", filename, "replace")
end)

mp.add_hook("on_before_start_file", 50, function ()
end)

mp.add_hook("on_load", 50, function ()
    loading = false
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

    local tracklist = mp.get_property_native("track-list")
    for _, track in ipairs(tracklist) do
        msg.info("track: "..tostring(track.type).." | "..tostring(track.title).." | "..tostring(track.id))
        if track.type == "sub" and track.title == "__fades__" then
            mp.set_property_native("file-local-options/sid", track.id)
        end
    end
end)

mp.add_hook("on_load_fail", 50, function ()
end)

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