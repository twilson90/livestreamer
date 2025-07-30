function linear(t, b, c, d)
    return c * t / d + b
end

function easeInQuad(t, b, c, d)
    t = t / d
    return c * t * t + b
end

function easeOutQuad(t, b, c, d)
    t = t / d
    return -c * t * (t - 2) + b
end

function easeInOutQuad(t, b, c, d)
    t = t / (d / 2)
    if t < 1 then
        return c / 2 * t * t + b
    else
        t = t - 1
        return -c / 2 * (t * (t - 2) - 1) + b
    end
end

function easeInCubic(t, b, c, d)
    t = t / d
    return c * t * t * t + b
end

function easeOutCubic(t, b, c, d)
    t = t / d - 1
    return c * (t * t * t + 1) + b
end

function easeInOutCubic(t, b, c, d)
    t = t / (d / 2)
    if t < 1 then
        return c / 2 * t * t * t + b
    else
        t = t - 2
        return c / 2 * (t * t * t + 2) + b
    end
end

function easeInQuart(t, b, c, d)
    t = t / d
    return c * t * t * t * t + b
end

function easeOutQuart(t, b, c, d)
    t = t / d - 1
    return -c * (t * t * t * t - 1) + b
end

function easeInOutQuart(t, b, c, d)
    t = t / (d / 2)
    if t < 1 then
        return c / 2 * t * t * t * t + b
    else
        t = t - 2
        return -c / 2 * (t * t * t * t - 2) + b
    end
end

function easeInQuint(t, b, c, d)
    t = t / d
    return c * t * t * t * t * t + b
end

function easeOutQuint(t, b, c, d)
    t = t / d - 1
    return c * (t * t * t * t * t + 1) + b
end

function easeInOutQuint(t, b, c, d)
    t = t / (d / 2)
    if t < 1 then
        return c / 2 * t * t * t * t * t + b
    else
        t = t - 2
        return c / 2 * (t * t * t * t * t + 2) + b
    end
end

function easeInSine(t, b, c, d)
    return -c * math.cos(t / d * (math.pi / 2)) + c + b
end

function easeOutSine(t, b, c, d)
    return c * math.sin(t / d * (math.pi / 2)) + b
end

function easeInOutSine(t, b, c, d)
    return -c / 2 * (math.cos(math.pi * t / d) - 1) + b
end

function easeInExpo(t, b, c, d)
    if t == 0 then
        return b
    else
        return c * math.pow(2, 10 * (t / d - 1)) + b
    end
end

function easeOutExpo(t, b, c, d)
    if t == d then
        return b + c
    else
        return c * (-math.pow(2, -10 * t / d) + 1) + b
    end
end

function easeInOutExpo(t, b, c, d)
    if t == 0 then return b end
    if t == d then return b + c end
    t = t / (d / 2)
    if t < 1 then
        return c / 2 * math.pow(2, 10 * (t - 1)) + b
    else
        t = t - 1
        return c / 2 * (-math.pow(2, -10 * t) + 2) + b
    end
end

function easeInCirc(t, b, c, d)
    t = t / d
    return -c * (math.sqrt(1 - t * t) - 1) + b
end

function easeOutCirc(t, b, c, d)
    t = t / d - 1
    return c * math.sqrt(1 - t * t) + b
end

function easeInOutCirc(t, b, c, d)
    t = t / (d / 2)
    if t < 1 then
        return -c / 2 * (math.sqrt(1 - t * t) - 1) + b
    else
        t = t - 2
        return c / 2 * (math.sqrt(1 - t * t) + 1) + b
    end
end

function easeInElastic(t, b, c, d, a, p)
    if t == 0 then return b end
    
    t = t / d
    if t == 1 then return b + c end
    
    p = p or d * 0.3
    local s
    
    if not a or a < math.abs(c) then
        a = c
        s = p / 4
    else
        s = p / (2 * math.pi) * math.asin(c / a)
    end
    
    t = t - 1
    return -(a * math.pow(2, 10 * t) * math.sin((t * d - s) * (2 * math.pi) / p)) + b
end

function easeOutElastic(t, b, c, d, a, p)
    if t == 0 then return b end
    
    t = t / d
    if t == 1 then return b + c end
    
    p = p or d * 0.3
    local s
    
    if not a or a < math.abs(c) then
        a = c
        s = p / 4
    else
        s = p / (2 * math.pi) * math.asin(c / a)
    end
    
    return a * math.pow(2, -10 * t) * math.sin((t * d - s) * (2 * math.pi) / p) + c + b
end

function easeInOutElastic(t, b, c, d, a, p)
    if t == 0 then return b end
    
    t = t / (d / 2)
    if t == 2 then return b + c end
    
    p = p or d * (0.3 * 1.5)
    local s
    
    if not a or a < math.abs(c) then
        a = c
        s = p / 4
    else
        s = p / (2 * math.pi) * math.asin(c / a)
    end
    
    if t < 1 then
        t = t - 1
        return -0.5 * (a * math.pow(2, 10 * t) * math.sin((t * d - s) * (2 * math.pi) / p)) + b
    else
        t = t - 1
        return a * math.pow(2, -10 * t) * math.sin((t * d - s) * (2 * math.pi) / p) * 0.5 + c + b
    end
end