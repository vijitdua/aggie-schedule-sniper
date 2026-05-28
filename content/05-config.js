(() => {
  const ASS = window.ASS;
  const schema = window.ASS_CONFIG_SCHEMA;
  const STORAGE_KEY = "assAdvancedConfig";

  const defaultConfig = { ...schema.DEFAULT_CONFIG };

  function parseConfigValue(key, raw) {
    if (raw === undefined || raw === null || raw === "") {
      return defaultConfig[key];
    }
    if (key === "clickRetryBackoffMs") {
      if (typeof raw === "string") {
        return raw
          .split(",")
          .map((v) => Number.parseInt(v.trim(), 10))
          .filter((n) => Number.isFinite(n));
      }
      return raw;
    }
    if (typeof defaultConfig[key] === "number") {
      const num = Number(raw);
      return Number.isFinite(num) ? num : defaultConfig[key];
    }
    if (key.endsWith("Regex")) {
      try {
        return new RegExp(String(raw), key === "passTimeRegex" ? "gi" : "i");
      } catch {
        return defaultConfig[key];
      }
    }
    return String(raw);
  }

  function applyAdvancedOverrides(overrides) {
    for (const [key, value] of Object.entries(overrides || {})) {
      if (!(key in defaultConfig)) {
        continue;
      }
      ASS.config[key] = parseConfigValue(key, value);
    }
  }

  function loadAdvancedConfig(callback) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      applyAdvancedOverrides(result[STORAGE_KEY] || {});
      callback?.(result[STORAGE_KEY] || {});
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) {
      return;
    }
    applyAdvancedOverrides(changes[STORAGE_KEY].newValue || {});
  });

  loadAdvancedConfig();

  ASS.api.loadAdvancedConfig = loadAdvancedConfig;
  ASS.api.getDefaultConfig = () => ({ ...defaultConfig });
  ASS.api.advancedConfigStorageKey = STORAGE_KEY;
})();
