const { getDefaultConfig } = require('@expo/metro-config');
const nodePath = require('path');

const config = getDefaultConfig(__dirname);

// `@gradio/client` has a Node-only branch that dynamically imports
// `fs/promises` and `path`. Metro still resolves those strings even
// though the branch is guarded at runtime — redirect them at resolve
// time to an empty shim so bundling succeeds.
const emptyShim = nodePath.resolve(__dirname, 'src/shims/empty.js');
const NODE_STUBS = new Set(['fs', 'fs/promises', 'path']);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_STUBS.has(moduleName)) {
    return { type: 'sourceFile', filePath: emptyShim };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
