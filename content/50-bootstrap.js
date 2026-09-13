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
      keepSessionAlive: state.settings.keepSessionAlive,
      keepScreenAwake: state.settings.keepScreenAwake,
      showProfessorRatings: state.settings.showProfessorRatings,
      showAdvancedPlanner: state.settings.showAdvancedPlanner,
      showCalendarExport: state.settings.showCalendarExport,
      browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  function initializeSettings(onReady) {
    const defaultSettings = {
      autoRegister: true,
      showCountdown: true,
      keepSessionAlive: true,
      keepScreenAwake: true,
      showProfessorRatings: true,
      showAdvancedPlanner: true,
      showCalendarExport: true,
    };

    chrome.storage.sync.get(defaultSettings, (storedValues) => {
      const isTestMode = !!state.simulatedPassTimeMs;

      if (isTestMode) {
        state.settings.autoRegister = true;
        state.settings.showCountdown = true;
        state.settings.keepSessionAlive = true;
        state.settings.keepScreenAwake = true;
        state.settings.showProfessorRatings = true;
        state.settings.showAdvancedPlanner = true;
        state.settings.showCalendarExport = true;

        chrome.storage.sync.set(
          {
            autoRegister: true,
            showCountdown: true,
            keepSessionAlive: true,
            keepScreenAwake: true,
            showProfessorRatings: true,
          },
          () => {
            onReady();
          },
        );

        return;
      }
      state.settings.autoRegister = !!storedValues.autoRegister;
      state.settings.showCountdown = !!storedValues.showCountdown;
      state.settings.keepSessionAlive = !!storedValues.keepSessionAlive;
      state.settings.keepScreenAwake = !!storedValues.keepScreenAwake;
      state.settings.showProfessorRatings =
        storedValues.showProfessorRatings !== false;
      state.settings.showAdvancedPlanner =
        storedValues.showAdvancedPlanner !== false;
      state.settings.showCalendarExport =
        storedValues.showCalendarExport !== false;
      onReady();
    });
  }

  function renderApp() {
    const passTimes = api.getParsedPassTimes();
    const armed = api.isSnipingArmed?.(passTimes) ?? false;
    if (window.self === window.top) {
      api.syncSessionGuard?.(armed);
    }
    const targetPass = api.selectTrackedPass(passTimes);
    const activePass = api.getCurrentlyActivePass(passTimes);
    api.initializePassTrackingState(passTimes);
    void api.maybeAttemptAutoRegistration(activePass);
    if (state.settings.showCalendarExport) {
      api.injectScheduleBuilderExportButton?.();
    } else {
      api.removeScheduleBuilderExportButton?.();
    }
    if (state.settings.showAdvancedPlanner) {
      api.ensureAdvancedPlannerUi?.();
    } else {
      api.removeAdvancedPlannerUi?.();
    }
    if (state.settings.showProfessorRatings) {
      api.syncProfessorRatings?.();
    } else {
      api.removeProfessorRatings?.();
    }
    api.renderOverlayUi(targetPass, activePass);
  }

  api.renderApp = renderApp;

  const extensionOrigin = new URL(chrome.runtime.getURL("/")).origin;

  function handleShowOnboardingRequest() {
    if (window.self !== window.top) {
      return;
    }
    api.closeDeveloperPanel?.();
    api.showOnboardingModal?.();
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== extensionOrigin) {
      return;
    }
    if (event.data?.type === "ASS_SHOW_ONBOARDING") {
      handleShowOnboardingRequest();
      return;
    }
    if (event.data?.type === "ASS_SHOW_WHATS_NEW") {
      if (window.self === window.top) {
        void api.forceShowWhatsNew?.();
      }
      return;
    }
    if (event.data?.type === "ASS_SHOW_FEEDBACK") {
      if (window.self === window.top) {
        api.forceShowFeedbackPrompt?.();
      }
      return;
    }
    if (event.data?.type === "ASS_OPEN_DEV_MENU") {
      api.openDeveloperPanel?.();
      return;
    }
    if (event.data?.type === "ASS_OPEN_ADVANCED_PLANNER") {
      api.openAdvancedPlannerModal?.({
        force: event.data?.force !== false,
      });
      return;
    }
    if (event.data?.type === "ASS_CLOSE_DEV_MENU") {
      api.closeDeveloperPanel?.();
    }
  });

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
        Object.prototype.hasOwnProperty.call(changes, "showCountdown") ||
        Object.prototype.hasOwnProperty.call(changes, "keepSessionAlive") ||
        Object.prototype.hasOwnProperty.call(changes, "keepScreenAwake") ||
        Object.prototype.hasOwnProperty.call(changes, "showProfessorRatings") ||
        Object.prototype.hasOwnProperty.call(changes, "showAdvancedPlanner") ||
        Object.prototype.hasOwnProperty.call(changes, "showCalendarExport");

      if (changes.autoRegister) {
        state.settings.autoRegister = !!changes.autoRegister.newValue;
      }

      if (changes.showCountdown) {
        state.settings.showCountdown = !!changes.showCountdown.newValue;
      }

      if (changes.keepSessionAlive) {
        state.settings.keepSessionAlive = !!changes.keepSessionAlive.newValue;
      }

      if (changes.keepScreenAwake) {
        state.settings.keepScreenAwake = !!changes.keepScreenAwake.newValue;
      }

      if (changes.showProfessorRatings) {
        state.settings.showProfessorRatings =
          changes.showProfessorRatings.newValue !== false;
      }

      if (changes.showAdvancedPlanner) {
        state.settings.showAdvancedPlanner =
          changes.showAdvancedPlanner.newValue !== false;
      }

      if (changes.showCalendarExport) {
        state.settings.showCalendarExport =
          changes.showCalendarExport.newValue !== false;
      }

      if (touched) {
        snipeLog("[settings_changed]", {
          autoRegister: state.settings.autoRegister,
          showCountdown: state.settings.showCountdown,
          keepSessionAlive: state.settings.keepSessionAlive,
          keepScreenAwake: state.settings.keepScreenAwake,
          showProfessorRatings: state.settings.showProfessorRatings,
          showAdvancedPlanner: state.settings.showAdvancedPlanner,
          showCalendarExport: state.settings.showCalendarExport,
          fromStorage: {
            autoRegister: changes.autoRegister,
            showCountdown: changes.showCountdown,
            keepSessionAlive: changes.keepSessionAlive,
            keepScreenAwake: changes.keepScreenAwake,
            showProfessorRatings: changes.showProfessorRatings,
            showAdvancedPlanner: changes.showAdvancedPlanner,
            showCalendarExport: changes.showCalendarExport,
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
