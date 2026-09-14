(() => {
  const { api } = window.ASS;
  const { snipeLog } = api;
  const ext = () => window.ASS_EXTENSION?.extensionOk?.() ?? true;

  /** One registrar refresh attempt per Schedule Builder page load. */
  let pagePrefetchPromise = null;

  function prefetchQuarterCalendarForPage() {
    if (window.self !== window.top) {
      return Promise.resolve({ ok: false, skipped: "iframe" });
    }
    if (pagePrefetchPromise) {
      return pagePrefetchPromise;
    }

    pagePrefetchPromise = new Promise((resolve) => {
      if (!ext()) {
        resolve({ ok: false, error: "Extension context invalidated — reload the page." });
        return;
      }
      chrome.runtime.sendMessage(
        { type: "ASS_REFETCH_QUARTER_CALENDAR" },
        (response) => {
          if (chrome.runtime.lastError) {
            snipeLog("[quarter_calendar]", {
              action: "page_prefetch_failed",
              error: chrome.runtime.lastError.message,
            });
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          snipeLog("[quarter_calendar]", {
            action: "page_prefetch",
            ok: !!response?.ok,
            error: response?.error || null,
            quarterCount: response?.cache?.quarters
              ? Object.keys(response.cache.quarters).length
              : null,
          });
          resolve(response || { ok: false });
        },
      );
    });

    return pagePrefetchPromise;
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
    await prefetchQuarterCalendarForPage();
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

  function listQuarterColumns(options = {}) {
    return prefetchQuarterCalendarForPage().then(
      () =>
        new Promise((resolve) => {
          if (!ext()) {
            resolve({
              ok: false,
              columns: [],
              error: "Extension context invalidated — reload the page.",
            });
            return;
          }
          chrome.runtime.sendMessage(
            {
              type: "ASS_LIST_QUARTER_COLUMNS",
              forceRefresh: !!options.forceRefresh,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({
                  ok: false,
                  columns: [],
                  error: chrome.runtime.lastError.message,
                });
                return;
              }
              resolve({
                ok: !!response?.ok,
                columns: response?.columns || [],
                error: response?.error,
              });
            },
          );
        }),
    );
  }

  // Kick off as soon as the content script loads on Schedule Builder.
  void prefetchQuarterCalendarForPage();

  Object.assign(api, {
    getQuarterBounds,
    listQuarterColumns,
    prefetchQuarterCalendarForPage,
  });
})();
