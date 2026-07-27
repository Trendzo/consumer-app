// Config plugin: slims Android release builds. Survives `expo prebuild`, so
// any regenerated android/ project (including the ~/trendzo-android-build
// mirror) picks these up automatically.
//
//   reactNativeArchitectures=arm64-v8a
//     — every real phone this app targets is arm64; the 4-ABI universal APK
//       shipped 4 copies of every native library (the debug build was ~100MB
//       mostly because of this). Revert to the full list + splits if the app
//       ever ships to Play as an AAB.
//   android.enableMinifyInReleaseBuilds=true
//   android.enableShrinkResourcesInReleaseBuilds=true
//     — R8 minify + resource shrink for release. These exact property names
//       are what the SDK-54 template android/app/build.gradle reads
//       (NOT the older `enableProguardInReleaseBuilds`).
const { withGradleProperties } = require('@expo/config-plugins');

const PROPS = {
  reactNativeArchitectures: 'arm64-v8a',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

module.exports = function withReleaseSlimming(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
