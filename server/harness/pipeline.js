/**
 * Pipeline — runs plugins in order around a core invocation.
 *
 * Each enabled plugin's `before(context)` runs in order, then the core
 * `invoke(context)`, then each plugin's `after(context, result)` in reverse.
 */
class Pipeline {
  constructor(plugins, options = {}) {
    this.plugins = plugins || [];
    this.options = options; // { enabled: { pluginName: true } }
  }

  isEnabled(name) {
    if (this.options && this.options.enabled && typeof this.options.enabled[name] === "boolean") {
      return this.options.enabled[name];
    }
    return true;
  }

  async run(context, invoke) {
    const enabled = this.plugins.filter((p) => this.isEnabled(p.name));
    const activated = [];

    // before phase
    for (const plugin of enabled) {
      if (!plugin.before) continue;
      const result = await plugin.before(context);
      context = result || context;
      activated.push(plugin);
    }

    // core invocation
    let result = await invoke(context);

    // after phase (reverse)
    for (let i = activated.length - 1; i >= 0; i -= 1) {
      const plugin = activated[i];
      if (!plugin.after) continue;
      result = (await plugin.after(context, result)) || result;
    }

    return result;
  }
}

module.exports = { Pipeline };