(() => {
  const { api } = window.ASS;
  const { snipeLog } = api;
  const MANUAL_BOUNDS_KEY = "assManualQuarterBounds";
  const ext = () => window.ASS_EXTENSION?.extensionOk?.() ?? true;

  function readManualBounds(termName) {
    return new Promise((resolve) => {
      if (!ext()) {
        resolve(null);
        return;
      }
      chrome.storage.local.get(MANUAL_BOUNDS_KEY, (result) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const entry = result[MANUAL_BOUNDS_KEY]?.[termName];
        if (entry?.instructionBegins && entry?.instructionEnds) {
          resolve({
            ok: true,
            termName,
            source: "manual",
            instructionBegins: entry.instructionBegins,
            instructionEnds: entry.instructionEnds,
            finalExaminations: null,
            quarterEnds: entry.instructionEnds,
          });
          return;
        }
        resolve(null);
      });
    });
  }

  function saveManualBounds(termName, instructionBegins, instructionEnds) {
    return new Promise((resolve) => {
      if (!ext()) {
        resolve(false);
        return;
      }
      chrome.storage.local.get(MANUAL_BOUNDS_KEY, (result) => {
        const all = result[MANUAL_BOUNDS_KEY] || {};
        all[termName] = { instructionBegins, instructionEnds };
        chrome.storage.local.set({ [MANUAL_BOUNDS_KEY]: all }, () => {
          snipeLog("[quarter_bounds]", {
            action: "manual_saved",
            termName,
            instructionBegins,
            instructionEnds,
          });
          resolve(!chrome.runtime.lastError);
        });
      });
    });
  }

  function fetchRegistrarBounds(termName, options = {}) {
    return new Promise((resolve) => {
      if (!ext()) {
        resolve({ ok: false, error: "Extension context invalidated — reload the page." });
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "ASS_GET_QUARTER_BOUNDS",
          termName,
          forceRefresh: !!options.forceRefresh,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response?.bounds || { ok: false, error: response?.error || "unknown" });
        },
      );
    });
  }

  async function getQuarterBounds(termName, options = {}) {
    const registrar = await fetchRegistrarBounds(termName, options);
    if (registrar.ok) {
      snipeLog("[quarter_bounds]", {
        source: registrar.source || "registrar",
        termName,
        column: registrar.registrarColumn,
        instructionBegins: registrar.instructionBegins,
        instructionEnds: registrar.instructionEnds,
      });
      return registrar;
    }

    const manual = await readManualBounds(termName);
    if (manual) {
      snipeLog("[quarter_bounds]", { source: "manual", termName, ...manual });
      return manual;
    }

    snipeLog("[quarter_bounds]", {
      ok: false,
      termName,
      error: registrar.error,
    });
    return registrar;
  }

  Object.assign(api, {
    getQuarterBounds,
    saveManualQuarterBounds: saveManualBounds,
    readManualQuarterBounds: readManualBounds,
  });
})();
