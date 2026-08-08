// Config plugin: makes the iOS build work from a path containing a space.
//
// This repo lives under ".../trendzo consumer/consumer-app". The React Native
// template's "Bundle React Native code and images" build phase ends with a bare
// backtick substitution:
//
//   `"$NODE_BINARY" --print "...react-native-xcode.sh"`
//
// The backticks resolve to the script's absolute path, and the shell then
// word-splits that path before executing it — so with a space in the path it
// tries to run "/Users/.../trendzo" and the build fails with
// "No such file or directory". Wrapping it as `/bin/sh "$( ... )"` keeps the
// path a single argument.
//
// ios/ is gitignored and regenerated, so this has to run at prebuild time
// rather than being patched into the checked-in project.
const { withXcodeProject } = require('@expo/config-plugins');

const BROKEN = /`("\$NODE_BINARY" --print "[^"]*react-native-xcode\.sh'")`/;

module.exports = function withIosBundleScriptSpaceFix(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};

    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase !== 'object' || !phase.shellScript) continue;
      if (!BROKEN.test(phase.shellScript)) continue;
      phase.shellScript = phase.shellScript.replace(BROKEN, '/bin/sh "$($1)"');
    }

    return cfg;
  });
};
