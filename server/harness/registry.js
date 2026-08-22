/**
 * Plugin registry — lets composable plugins be registered by name and version.
 */
class PluginRegistry {
  constructor() {
    this._plugins = new Map();
  }

  /**
   * Register a plugin. Plugin contract:
   *   { name, version, async before(context), async after(context,result) }
   */
  register(plugin) {
    if (!plugin || !plugin.name) {
      throw new Error("Plugin harus memiliki nama");
    }
    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' sudah terdaftar (duplicate registration)`);
    }
    this._plugins.set(plugin.name, {
      name: plugin.name,
      version: plugin.version || "1.0.0",
      before: typeof plugin.before === "function" ? plugin.before.bind(plugin) : null,
      after: typeof plugin.after === "function" ? plugin.after.bind(plugin) : null,
    });
    return this;
  }

  has(name) {
    return this._plugins.has(name);
  }

  get(name) {
    return this._plugins.get(name);
  }

  list() {
    return Array.from(this._plugins.values());
  }

  resolve(versionSpec) {
    // versionSpec: "rubric" or "rubric@1.0.0" — resolve latest/any for now.
    const [name, version] = String(versionSpec || "").split("@");
    const plugin = this._plugins.get(name);
    if (!plugin) return null;
    if (version && plugin.version !== version) {
      throw new Error(`Plugin '${name}' versi ${plugin.version} tidak cocok dengan permintaan ${version}`);
    }
    return plugin;
  }
}

module.exports = { PluginRegistry };