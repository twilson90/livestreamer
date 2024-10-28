const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { MakerDeb } = require('@electron-forge/maker-deb');
const { MakerRpm } = require('@electron-forge/maker-rpm');
const { minimatch } = require('minimatch');
const { glob } = require('glob');
const path = require("node:path");
/** @import { ForgeConfig, ResolvedForgeConfig } from '@electron-forge/shared-types' */

const IGNORE = [
  "forge.config.*"
];

/** @type {ForgeConfig} */
const config = {
  // relative to config
  outDir: "../out",
  packagerConfig: {
    icon: "assets/icon.png",
    asar: false,
    // asar: true,
    ignore(p) {
      if (!p) return false;
      return IGNORE.some(i=>minimatch(p.slice(1), i, {dot:true}));
    },
    // cwd
    /* extraResource: [
      "./bin/win"
    ] */
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}),
    new MakerRpm({})
  ],
  plugins: [
    // {
    //   name: '@electron-forge/plugin-auto-unpack-natives',
    //   config: {},
    // },
    // // Fuses are used to enable/disable various Electron functionality
    // // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    })
  ],
};
// export default config;
module.exports = config;