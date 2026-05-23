(() => {
  const ASS = window.ASS;
  const { config, state, debug, api } = ASS;
  const { snipeLog, flushDebugLogsToStorage } = api;

  function shouldRunContentScriptInThisFrame() {
    if (window.self === window.top) {
      return true;
    }

    return !!(
      document.getElementById("PassTimesContainer") ||
      document.querySelector(".passtime-container") ||
      document.querySelector(".schedule-builder")
    );
  }

  function emitStartupSnapshot(extra) {
    if (ASS.startupSnapshotLogged) {
      return;
    }
    ASS.startupSnapshotLogged = true;

    const manifest = chrome.runtime.getManifest?.() || {};
    const ucdTestSeconds = api.getUcdTestDelaySecondsFromUrl();
    const inTestMode = !!state.simulatedPassTimeMs;
    const ucdTestFromQuery = new URLSearchParams(location.search).get(
      "ucdTest",
    );
    const ucdTestFromHash = location.hash.match(/ucdTest=(\d+)/i)?.[1];

    snipeLog("[startup]", {
      ...extra,
      extensionVersion: manifest.version ?? "unknown",
      extensionName: manifest.name,
      href: location.href,
      isTopFrame: window.self === window.top,
      mode: inTestMode ? "ucdTest_simulated_pass" : "live_page_pass_times",
      ucdTest: inTestMode
        ? {
            delaySecondsFromUrl: ucdTestSeconds,
            paramSource: ucdTestFromQuery ? "query" : "hash",
            simulatedPassOpensAtMs: state.simulatedPassTimeMs,
            simulatedPassOpensAtIso: new Date(
              state.simulatedPassTimeMs,
            ).toISOString(),
            note: "Extension uses the simulated pass above for countdown/sniping. domWouldParseIfNotTest shows what the same page text would yield without ucdTest.",
          }
        : null,
      autoRegister: state.settings.autoRegister,
      showCountdown: state.settings.showCountdown,
      browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  function initializeSettings(onReady) {
    const defaultSettings = {
      autoRegister: true,
      showCountdown: true,
    };

    chrome.storage.sync.get(defaultSettings, (storedValues) => {
      const isTestMode = !!state.simulatedPassTimeMs;

      if (isTestMode) {
        state.settings.autoRegister = true;
        state.settings.showCountdown = true;

        chrome.storage.sync.set(
          {
            autoRegister: true,
            showCountdown: true,
          },
          () => {
            onReady();
          },
        );

        return;
      }
      state.settings.autoRegister = !!storedValues.autoRegister;
      state.settings.showCountdown = !!storedValues.showCountdown;
      onReady();
    });
  }

  function renderApp() {
    const passTimes = api.getParsedPassTimes();
    const targetPass = api.selectTrackedPass(passTimes);
    const activePass = api.getCurrentlyActivePass(passTimes);
    api.initializePassTrackingState(passTimes);
    void api.maybeAttemptAutoRegistration(activePass);
    api.renderOverlayUi(targetPass, activePass);
  }

  api.renderApp = renderApp;

  function bootstrap() {
    if (!shouldRunContentScriptInThisFrame()) {
      snipeLog("[startup]", {
        skipped: true,
        reason: "frame_not_used",
        isTopFrame: window.self === window.top,
        href: location.href,
      });
      return;
    }

    window.addEventListener("pagehide", () => {
      if (debug.persistTimerId != null) {
        clearTimeout(debug.persistTimerId);
        debug.persistTimerId = null;
      }
      flushDebugLogsToStorage();
    });

    initializeSettings(() => {
      const passTimes = api.getParsedPassTimes();
      const domWouldParse = api.getDomPassTimeDiagnostics();
      emitStartupSnapshot({
        passesDrivingExtension: passTimes.map((p) => ({
          passNumber: p.passNumber,
          opensAtMs: p.dateMs,
          opensAtIso: new Date(p.dateMs).toISOString(),
        })),
        domWouldParseIfNotTest: domWouldParse,
      });
      api.ensureOverlayUi();
      api.maybeShowOnboarding();
      state.renderTimerId = setInterval(renderApp, config.renderIntervalMs);
      renderApp();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      const touched =
        Object.prototype.hasOwnProperty.call(changes, "autoRegister") ||
        Object.prototype.hasOwnProperty.call(changes, "showCountdown");

      if (changes.autoRegister) {
        state.settings.autoRegister = !!changes.autoRegister.newValue;
      }

      if (changes.showCountdown) {
        state.settings.showCountdown = !!changes.showCountdown.newValue;
      }

      if (touched) {
        snipeLog("[settings_changed]", {
          autoRegister: state.settings.autoRegister,
          showCountdown: state.settings.showCountdown,
          fromStorage: {
            autoRegister: changes.autoRegister,
            showCountdown: changes.showCountdown,
          },
        });
      }

      renderApp();
    });

    new MutationObserver(() => {
      if (
        state.cachedRegisterButton &&
        !document.contains(state.cachedRegisterButton)
      ) {
        state.cachedRegisterButton = null;
      }
    }).observe(document, { childList: true, subtree: true });
  }

  bootstrap();
})();
