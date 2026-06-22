// Empty module used to shim Node-only imports (fs/promises, path) so
// Metro can bundle packages that reference them inside Node-only code
// paths. At runtime those paths are guarded by `process.versions.node`
// so this stub is never actually executed in React Native.
module.exports = {};
