local msg = require("mp.msg")
local utils = require("mp.utils")
local options = require("mp.options")
local unpack = unpack or table.unpack

local o = {
    ["fix_discontinuities"] = true,
}

options.read_options(o, "livestreamer")

local volume_target = 100
local volume_speed = 1
local volume = mp.get_property_native("volume")
local props = {}

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
        if cb ~= nil then cb(k, v) end
    end)
end

function register_script_message(name, cb)
    mp.register_script_message(name, function(json)
        local args = JSON.parse(json)
        cb(unpack(args))
    end)
end

------------------

local last_pts = 0
observe_property("audio-pts", function(k, v)
    if v ~= last_pts and v ~= nil and volume_speed ~= 0 then
        local delta = v - last_pts
        if delta > 0 and volume_target ~= volume then
            local inc = delta * volume_speed
            local new_volume = volume
            if volume < volume_target then
                new_volume = math.min(volume + inc, volume_target)
            else
                new_volume = math.max(volume - inc, volume_target)
            end
            volume = new_volume
            mp.set_property_native("volume", volume)
        end
        last_pts = v
    end
end)

local loads = 0
local loadfile_opts = {}
local loadfile_id = 0

-- function get_current_playlist_entry_id()
--     local playlist = mp.get_property_native("playlist")
--     local playlist_pos = mp.get_property_native("playlist-pos") + 1
--     msg.info("playlist_pos: "..tostring(playlist_pos))
--     if playlist and playlist[playlist_pos] then
--         return playlist[playlist_pos].id
--     end
--     return -1
-- end

register_script_message("setup_loadfile", function(_loadfile_opts)
    loadfile_opts = _loadfile_opts
    loadfile_opts.id = loads + 1
end)

register_script_message("update_volume", function(t, s, immediate)
    volume_target = t
    volume_speed = s
    if volume_speed == 0 or immediate then
        volume = volume_target
        mp.set_property_native("volume", volume)
    end
end)

local last_audio_error = nil
local last_audio_error_ts = 0
mp.register_event("log-message", function(e)
    if e.prefix == "ad" and e.level == "error" then
        last_audio_error = e.text
        last_audio_error_ts = mp.get_time()
    end
    if e.prefix == "ad" and e.level == "warn" then
        if o["fix_discontinuities"] then
            local m = e.text:match("^Invalid audio PTS:")
            local time_since_last_error = mp.get_time() - last_audio_error_ts
            if m and time_since_last_error < 1.0 then
                t1,t2 = e.text:match("^Invalid audio PTS: ([%d%.]+) %-> ([%d%.]+)")
                msg.info("audio discontinuity detected, attempting seek to new PTS: "..t1.." -> "..t2)
                local discontinuity_pts = tonumber(t2)
                mp.commandv("seek", discontinuity_pts, "absolute")
            end
        end
    end
end)

mp.add_hook("on_before_start_file", 50, function ()
end)

mp.add_hook("on_load", 50, function ()
    local filename = mp.get_property_native("stream-open-filename")
    msg.info("on_load: "..filename)
    if filename == "null://eof" then
        filename = "av://lavfi:color=c=#000000:s="..tostring(loadfile_opts.width).."x"..tostring(loadfile_opts.height)..":r="..tostring(loadfile_opts.fps).."[out0];anullsrc=channel_layout=stereo:sample_rate=44100[out1]"
        mp.set_property_native("stream-open-filename", filename)
    end
    mp.set_property("keep-open", "always") -- have to set it here because 'encoding' auto-profile will always change this to 'no' ...
    mp.set_property_native("keep-open-pause", false)
    if props.o then
        mp.set_property("framedrop", "vo")
    end
    loads = loads + 1
end)

mp.add_hook("on_load_fail", 50, function ()
    local path = mp.get_property_native("path")
    local filename = mp.get_property_native("stream-open-filename")
    -- local current_playlist_entry_id = get_current_playlist_entry_id()
    -- local ytdl_res = mp.get_property_native("user-data/mpv/ytdl/json-subprocess-result")
    -- if path == loadfile_opts.filename then
    if loadfile_opts.id == loads then
        -- if stream-open-filename is different then ytdl_hook has presumably done its work
        if path == filename and filename ~= "null://eof" then
            mp.commandv("loadfile", "null://eof", "replace")
        end
    end
end)

mp.add_hook("on_preloaded", 50, function ()
    local path = mp.get_property_native("path")
    if path == loadfile_opts.filename then
        if loadfile_opts.commands then
            msg.info("loadfile_opts.commands: "..JSON.stringify(loadfile_opts.commands))
            for _,c in ipairs(loadfile_opts.commands) do
                local _,err = mp.commandv(unpack(c))
                if err then
                    msg.info(err)
                end
            end
        end
        if loadfile_opts.props then
            msg.info("loadfile_opts.props: "..JSON.stringify(loadfile_opts.props))
            for k,v in pairs(loadfile_opts.props) do
                mp.set_property_native(k, v)
            end
        end
    end
end)