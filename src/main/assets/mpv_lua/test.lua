package.path = (debug.getinfo(1,"S").source:match([[^@?(.*[\/])[^\/]-$]]) or "./").."?.lua;"..package.path
local ON_WINDOWS = (package.config:sub(1,1) ~= '/')
local tmp_dir = ON_WINDOWS and os.getenv('TEMP') or (os.getenv('TMP') or '/tmp/')

local assdraw = require("mp.assdraw")
local options = require("mp.options")
local msg = require("mp.msg")
local utils = require("mp.utils")
local base64 = require("base64")
local md5 = require("md5")
function hash(str)
    local m = md5.new()
    m:update(str)
    return md5.tohex(m:finish())
end

msg.info(debug.getinfo(1,"S").source)
msg.info(hash("JHAGJASD"))

local settings = {
    ["hello"] = "",
    ["socket-path"] = "",
    ["fuck-fuck"] = "",
}
options.read_options(settings, "test", function(changes)
    msg.info("options changed: "..utils.format_json(changes))
end)
msg.info("settings: "..utils.format_json(settings))