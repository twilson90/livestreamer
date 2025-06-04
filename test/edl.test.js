import { expect, test } from 'vitest';
import { MPVEDL } from "../src/main/MPVEDL.js";

var edl_str = `edl://!new_stream;!no_clip;!no_chapters;%1150%https://manifest.googlevideo.com/api/manifest/hls_playlist/expire/1748026333/ei/fW8waJK3LfH6hcIP3_Pj8Qk/ip/2a02:c7e:2fac:f300:85ef:76d2:7960:e2b7/id/94ce8da13c7614fe/itag/270/source/youtube/requiressl/yes/ratebypass/yes/pfa/1/sgovp/clen%3D30042177%3Bdur%3D106.731%3Bgir%3Dyes%3Bitag%3D137%3Blmt%3D1738962423878523/rqh/1/hls_chunk_host/rr2---sn-cn3tc-cimk.googlevideo.com/xpc/EgVo2aDSNQ%3D%3D/met/1748004733,/mh/Mv/mm/31,29/mn/sn-cn3tc-cimk,sn-aigl6nek/ms/au,rdu/mv/m/mvi/2/pl/42/rms/au,au/initcwndbps/3413750/bui/AecWEAbP3DJoaDRukpiKP6V2mImGB59J5R2zjIt9OOLK8gXAgXESJGozP2SsZlz1GDDyHGU1Sbrl3vmr/spc/wk1kZsXFfTjfjdz9R0eHvapF-sxiU9BdIZ_gLfA14KYWNeovuN4/vprv/1/playlist_type/DVR/dover/13/txp/1318224/mt/1748004341/fvip/1/short_key/1/keepalive/yes/sparams/expire,ei,ip,id,itag,source,requiressl,ratebypass,pfa,sgovp,rqh,xpc,bui,spc,vprv,playlist_type/sig/AJfQdSswRAIgH2UIsNyU9r7r4KEyHwvyE2CSmbVL2XYiRKQ9uTgsFoQCIAdkErUMcYNVxIz5enyS_BTTCXlXQ6Qb1Putl0aY8eY8/lsparams/hls_chunk_host,met,mh,mm,mn,ms,mv,mvi,pl,rms,initcwndbps/lsig/ACuhMU0wRQIhANY0G8Nod-6TDVy_1t-1Tnk-0xCR52_HI0GOaS3vxW5OAiAh93p_VVSK0k8AmIK8FWAhyPZi6pLYASj3hvBeJl1-Gg%3D%3D/playlist/index.m3u8;!global_tags,ytdl_description=%283%Just a random video with diy anamorphic filter and 12fps
Enjoyed? Check out my latest work! https://www.youtube.com/watch?v=Or1XhSV3zqw


A quality test.
Shot with the canon 600d with a 1.8 50mm lens and an anamorphic filter. At times the camera can create brilliant picture quality.,date=%8%20140414,uploader=%11%BijouCinema,channel_url=%56%https://www.youtube.com/channel/UCkG3FDvHJ4JSZSq1Vom-iIw`;

test("edl parsing", ()=>{

    var edl = MPVEDL.parse(edl_str);
    
    expect(edl.entries[0].header).toBe("!new_stream");
    expect(edl.entries[1].header).toBe("!no_clip");
    expect(edl.entries[2].header).toBe("!no_chapters");
    expect(edl.entries[3].header).toBe("https://manifest.googlevideo.com/api/manifest/hls_playlist/expire/1748026333/ei/fW8waJK3LfH6hcIP3_Pj8Qk/ip/2a02:c7e:2fac:f300:85ef:76d2:7960:e2b7/id/94ce8da13c7614fe/itag/270/source/youtube/requiressl/yes/ratebypass/yes/pfa/1/sgovp/clen%3D30042177%3Bdur%3D106.731%3Bgir%3Dyes%3Bitag%3D137%3Blmt%3D1738962423878523/rqh/1/hls_chunk_host/rr2---sn-cn3tc-cimk.googlevideo.com/xpc/EgVo2aDSNQ%3D%3D/met/1748004733,/mh/Mv/mm/31,29/mn/sn-cn3tc-cimk,sn-aigl6nek/ms/au,rdu/mv/m/mvi/2/pl/42/rms/au,au/initcwndbps/3413750/bui/AecWEAbP3DJoaDRukpiKP6V2mImGB59J5R2zjIt9OOLK8gXAgXESJGozP2SsZlz1GDDyHGU1Sbrl3vmr/spc/wk1kZsXFfTjfjdz9R0eHvapF-sxiU9BdIZ_gLfA14KYWNeovuN4/vprv/1/playlist_type/DVR/dover/13/txp/1318224/mt/1748004341/fvip/1/short_key/1/keepalive/yes/sparams/expire,ei,ip,id,itag,source,requiressl,ratebypass,pfa,sgovp,rqh,xpc,bui,spc,vprv,playlist_type/sig/AJfQdSswRAIgH2UIsNyU9r7r4KEyHwvyE2CSmbVL2XYiRKQ9uTgsFoQCIAdkErUMcYNVxIz5enyS_BTTCXlXQ6Qb1Putl0aY8eY8/lsparams/hls_chunk_host,met,mh,mm,mn,ms,mv,mvi,pl,rms,initcwndbps/lsig/ACuhMU0wRQIhANY0G8Nod-6TDVy_1t-1Tnk-0xCR52_HI0GOaS3vxW5OAiAh93p_VVSK0k8AmIK8FWAhyPZi6pLYASj3hvBeJl1-Gg%3D%3D/playlist/index.m3u8");
    expect(edl.entries[4].header).toBe("!global_tags")
    expect(edl.entries[4].params["ytdl_description"]).toBe(`Just a random video with diy anamorphic filter and 12fps
Enjoyed? Check out my latest work! https://www.youtube.com/watch?v=Or1XhSV3zqw


A quality test.
Shot with the canon 600d with a 1.8 50mm lens and an anamorphic filter. At times the camera can create brilliant picture quality.`);

    expect(edl.entries[4].params["date"]).toBe("20140414");
    expect(edl.entries[4].params["uploader"]).toBe("BijouCinema");
    expect(edl.entries[4].params["channel_url"]).toBe("https://www.youtube.com/channel/UCkG3FDvHJ4JSZSq1Vom-iIw");
});
