local msg = require("mp.msg")
local utils = require("mp.utils")
local options = require("mp.options")

local unpack = unpack or table.unpack

local o = {
    ["keep_open"] = false,
    ["fix_discontinuities"] = false,
    ["width"] = 1280,
    ["height"] = 720,
    ["fps"] = 25,
    ["handle_load_fail"] = false,
    ["default_vf"] = {},
    ["default_af"] = {},
}
options.read_options(o, "livestreamer")

local volume = 100
local volume_target = 100
local volume_speed = 0
local props = {}
local loads = 0
local loadfile_opts = {}
local id = 0

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

function uuidv4()
    local template ='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function(c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
end

function observe_property(k, cb)
    props[k] = mp.get_property_native(k)
    local fn = function(k, v)
        props[k] = v
        if cb ~= nil then cb(k, v) end
    end
    mp.observe_property(k, "native", fn)
    return fn
end

function unobserve_property(fn)
    mp.unobserve_property(fn)
end

function register_script_message(name, cb)
    mp.register_script_message(name, function(json)
        local args = JSON.parse(json)
        cb(unpack(args))
    end)
end

function move_toward(current, target, speed, delta)
    local direction = target - current
    local distance = math.abs(direction)
    if distance < 0.001 then  -- Small threshold to prevent jitter
        return target
    end
    -- Move at constant speed, but don't overshoot
    local move = math.min(speed * delta, distance)
    return current + direction * (move / distance)
end

local function findIndex(t, fn)
    for i, v in ipairs(t) do
        if fn(v) then
            return i
        end
    end
    return nil -- not found
end


------------------

local last_pts = 0
observe_property("o")
observe_property("volume")
observe_property("audio-pts", function(_, pts)
    if pts ~= nil and last_pts ~= nil and pts > last_pts then
        local delta = pts - last_pts
        volume = move_toward(volume, volume_target, 100/volume_speed, delta)
        if props.volume ~= volume then
            mp.set_property_native("volume", volume)
        end
    end
    last_pts = pts or 0
end)

function on_after_playback_restart(cb)
    mp.register_event("playback-restart", function()
        local time_pos_id
        time_pos_id = observe_property("time-pos", function(_, pos)
            pos = pos or 0
            if pos > 0.2 then
                unobserve_property(time_pos_id)
                cb()
            end
        end)
    end)
end

register_script_message("init", function(opts)
    for k,v in pairs(opts) do
        o[k] = v
    end
    msg.info("init: "..JSON.stringify(o))
end)

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
    if filename == "null://invalid" then
        filename = "av://lavfi:smptebars=size="..tostring(o.width).."x"..tostring(o.height)..":rate="..tostring(o.fps).."[out0];anullsrc=channel_layout=stereo:sample_rate=44100[out1]"
        mp.set_property_native("stream-open-filename", filename)
    end

    mp.set_property("keep-open", o.keep_open and "always" or "no") -- have to set it here because 'encoding' auto-profile will always change this to 'no' ...
    mp.set_property_native("keep-open-pause", not o.keep_open)
    --[[ if props.o then
        mp.set_property("framedrop", "vo")
    end ]]
end)

mp.add_hook("on_load_fail", 50, function ()
    if o.handle_load_fail then
        mp.commandv("loadfile", "null://invalid", "replace")
    end
end)

local track_list = {}
local loaded_map = {}

function update_tracks()
    track_list = mp.get_property_native("track-list")
    loaded_map = {audio={}, video={}, sub={}}
    local albumart_tracks = {}
    for _,t in ipairs(track_list) do
        table.insert(loaded_map[t.type], t)
    end
    msg.verbose("track-list: "..JSON.stringify(track_list))
end

mp.add_hook("on_preloaded", 50, function ()

    local filename = mp.get_property_native("path")
    msg.info("on_preloaded: "..filename)

    if filename == "null://invalid" then
        mp.set_property_native("file-local-options/vf", o.default_vf)
        mp.set_property_native("file-local-options/af", o.default_af)
        mp.set_property_native("file-local-options/end", "5")
        update_tracks()
        return
    end
    
    if loadfile_opts.commands then
        msg.verbose("loadfile_opts.commands: "..JSON.stringify(loadfile_opts.commands))
        for _,c in ipairs(loadfile_opts.commands) do
            local _,err = mp.command_native(c)
            if err then
                msg.info(err)
            end
        end
    end

    update_tracks()

    local expected_map = {audio={}, video={}, sub={}}
    if loadfile_opts.streams then
        for _,t in ipairs(loadfile_opts.streams) do
            local type = t.type
            if type == "subtitle" then type = "sub" end
            if expected_map[type] ~= nil then
                table.insert(expected_map[type], t)
            end
        end
    end

    for k,_ in pairs(expected_map) do
        if #loaded_map[k] ~= #expected_map[k] then
            msg.warn(k.." tracks mismatch, loaded "..tostring(#loaded_map[k])..", expected "..tostring(#expected_map[k]))
            msg.warn(k.." tracks mismatch further details: "..JSON.stringify(loaded_map[k]).." != "..JSON.stringify(expected_map[k]))
        end
    end

    if loadfile_opts.props then
        local props = loadfile_opts.props

        --[[ if props.vid and loaded_map["video"][props.vid] == nil or loaded_map["video"][props.vid].albumart then
            props.vid = findIndex(loaded_map["video"], function(s) return not s.albumart end)
            msg.warn("video track "..tostring(props.vid).." not found, using first track: "..JSON.stringify(loaded_map["video"][props.vid]))
        end
        if props.aid and loaded_map["audio"][props.aid] == nil then
            props.aid = 1
            msg.warn("audio track "..tostring(props.aid).." not found, using first track: "..JSON.stringify(loaded_map["audio"][props.aid]))
        end
        if props.sid and loaded_map["sub"][props.sid] == nil then
            props.sid = false
            msg.warn("subtitle track "..tostring(props.sid).."not found, using none")
        end ]]

        msg.verbose("loadfile_opts.props: "..JSON.stringify(props))
        for k,v in pairs(props) do
            mp.set_property_native("file-local-options/"..k, v)
        end
    end
end)