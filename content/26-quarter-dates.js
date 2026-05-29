(() => {
  const { api } = window.ASS;
  const { snipeLog } = api;
  const ext = () => window.ASS_EXTENSION?.extensionOk?.() ?? true;

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

    snipeLog("[quarter_bounds]", {
      ok: false,
      termName,
      error: registrar.error,
    });
    return registrar;
  }

  Object.assign(api, {
    getQuarterBounds,
  });
})();
