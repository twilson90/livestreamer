import acompressor from "./filters/acompressor.js";
import adelay from "./filters/adelay.js";
import adynamicsmooth from "./filters/adynamicsmooth.js";
import aecho from "./filters/aecho.js";
import alimiter from "./filters/alimiter.js";
import amplify from "./filters/amplify.js";
import aphaser from "./filters/aphaser.js";
import apulsator from "./filters/apulsator.js";
import asoftclip from "./filters/asoftclip.js";
import avgblur from "./filters/avgblur.js";
import color from "./filters/color.js";
import colorbalance from "./filters/colorbalance.js";
import colorchannelmixer from "./filters/colorchannelmixer.js";
import colorcontrast from "./filters/colorcontrast.js";
import colorcorrect from "./filters/colorcorrect.js";
import colorize from "./filters/colorize.js";
import colorlevels from "./filters/colorlevels.js";
import colortemperature from "./filters/colortemperature.js";
import convolution from "./filters/convolution.js";
import curves from "./filters/curves.js";
import deband from "./filters/deband.js";
import deblock from "./filters/deblock.js";
import dynaudnorm from "./filters/dynaudnorm.js";
import earwax from "./filters/earwax.js";
import edgedetect from "./filters/edgedetect.js";
import elbg from "./filters/elbg.js";
import eq from "./filters/eq.js";
import equalizer from "./filters/equalizer.js";
import flanger from "./filters/flanger.js";
import framestep from "./filters/framestep.js";
import gblur from "./filters/gblur.js";
import hflip from "./filters/hflip.js";
import huesaturation from "./filters/huesaturation.js";
import lagfun from "./filters/lagfun.js";
import loudnorm from "./filters/loudnorm.js";
import negate from "./filters/negate.js";
import noise from "./filters/noise.js";
import normalize from "./filters/normalize.js";
import pixelize from "./filters/pixelize.js";
import rgbshift from "./filters/rgbshift.js";
import rubberband from "./filters/rubberband.js";
import scroll from "./filters/scroll.js";
import shear from "./filters/shear.js";
import showspectrum from "./filters/showspectrum.js";
import showwaves from "./filters/showwaves.js";
import tblend from "./filters/tblend.js";
import tmix from "./filters/tmix.js";
import tremolo from "./filters/tremolo.js";
import vflip from "./filters/vflip.js";
import vibrato from "./filters/vibrato.js";
import vignette from "./filters/vignette.js";
import volume from "./filters/volume.js";

export const filters = {
    acompressor,
    adelay,
    adynamicsmooth,
    aecho,
    alimiter,
    amplify,
    aphaser,
    apulsator,
    asoftclip,
    avgblur,
    // color,
    colorbalance,
    colorchannelmixer,
    colorcontrast,
    colorcorrect,
    colorize,
    colorlevels,
    colortemperature,
    convolution,
    curves,
    deband,
    deblock,
    dynaudnorm,
    earwax,
    edgedetect,
    elbg,
    eq,
    equalizer,
    flanger,
    framestep,
    // gblur, // this has issues, causes crashes with some videos.
    hflip,
    huesaturation,
    lagfun,
    loudnorm,
    negate,
    noise,
    normalize,
    pixelize,
    rgbshift,
    rubberband,
    scroll,
    shear,
    showspectrum,
    showwaves,
    tblend,
    tmix,
    tremolo,
    vflip,
    vibrato,
    vignette,
    volume
}