/**
 * Canonical manifest for the assessment harness.
 *
 * The manifest is deliberately data-only: it gives the research layer a stable
 * description of which components participated in a run without coupling it to
 * Pipeline internals. Versions are captured from registered plugins at runtime.
 */
const MANIFEST_VERSION = "1.0.0";

function buildHarnessManifest({ config, plugins } = {}) {
  const registered = Array.isArray(plugins) ? plugins : [];
  const enabled = (config && config.pipeline) || {};

  return {
    manifestVersion: MANIFEST_VERSION,
    harnessVersion: (config && config.version) || null,
    engineVersion: (config && config.engineVersion) || null,
    model: config && config.model ? { ...config.model } : null,
    components: registered.map((plugin) => ({
      name: plugin.name,
      version: plugin.version || "1.0.0",
      enabled: enabled[plugin.name] !== false,
    })),
  };
}

module.exports = { MANIFEST_VERSION, buildHarnessManifest };
