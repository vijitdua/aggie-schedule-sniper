(() => {
  const { config, state, api } = window.ASS;
  const { snipeLog } = api;

  const guardWindow = window.top;
  let keepaliveTimerId = null;
  let wakeLockSentinel = null;
  let beforeUnloadHandler = null;
  let sessionGuardActive = false;
  let closeWarningActive = false;
  let wakeLockHeld = false;
  let reloadIntent = false;
  let reloadIntentTimer = null;
  let sessionModalWasVisible = false;
  let lastSessionModalClickAtMs = 0;

  if (window.self === guardWindow) {
    document.addEventListener(
      "keydown",
      (event) => {
        const isReload =
          event.key === "F5" ||
          ((event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "r");
        if (!isReload) {
          return;
        }
        reloadIntent = true;
        clearTimeout(reloadIntentTimer);
        reloadIntentTimer = setTimeout(() => {
          reloadIntent = false;
          reloadIntentTimer = null;
        }, 2000);
      },
      true,
    );
  }

  function isSnipingArmed(passTimes) {
    if (state.simulatedPassTimeMs) {
      return true;
    }
    const targetPass = api.selectTrackedPass(passTimes);
    return (
      !!targetPass &&
      Date.now() <= targetPass.dateMs + config.passActiveWindowMs
    );
  }

  function findContinueSessionButton() {
    for (const el of document.querySelectorAll(
      config.sessionContinueButtonSelector,
    )) {
      const text = (el.textContent || el.value || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!config.sessionContinueButtonTextRegex.test(text) || el.disabled) {
        continue;
      }
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        return el;
      }
    }
    return null;
  }

  /** If the UC Davis session modal is open, show a warning and click Continue Session. */
  function handleSessionExpiryModal(armed) {
    const button = findContinueSessionButton();
    const visible = !!button;
    state.sessionExpiryWarning = visible;

    if (visible !== sessionModalWasVisible) {
      sessionModalWasVisible = visible;
      snipeLog("[session_expiry_warning]", { visible, href: location.href });
    }

    if (!visible || !armed || !state.settings.keepSessionAlive) {
      return;
    }

    const now = Date.now();
    if (now - lastSessionModalClickAtMs < config.sessionContinueClickCooldownMs) {
      return;
    }

    lastSessionModalClickAtMs = now;
    snipeLog("[session_continue]", { action: "click" });
    button.click();
  }

  async function fetchKeepaliveStatus(url, init) {
    try {
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...init,
      });
      return response.status;
    } catch (error) {
      return error?.message || String(error);
    }
  }

  async function runSessionKeepalivePulse(source = "interval") {
    if (!state.settings.keepSessionAlive) {
      return;
    }

    const termCode = new URLSearchParams(location.search).get("termCode");
    const results = {
      source,
      bkg: await fetchKeepaliveStatus(config.sessionBkgEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: config.sessionBkgPayload,
      }),
      updateSchedule: null,
    };

    if (termCode) {
      const schedule = encodeURIComponent("Schedule 1");
      results.updateSchedule = await fetchKeepaliveStatus(
        `/schedulebuilder/updateSchedule.cfm?Term=${encodeURIComponent(termCode)}&Schedule=${schedule}&ShowDebug=0`,
        {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        },
      );
    }

    state.lastSessionKeepaliveAtMs = Date.now();
    snipeLog("[session_keepalive]", results);
    handleSessionExpiryModal(sessionGuardActive);
  }

  function catchUpSessionKeepaliveIfNeeded() {
    if (document.visibilityState !== "visible" || !state.settings.keepSessionAlive) {
      return;
    }
    if (!isSnipingArmed(api.getParsedPassTimes())) {
      return;
    }

    const elapsed = Date.now() - (state.lastSessionKeepaliveAtMs || 0);
    if (
      state.lastSessionKeepaliveAtMs &&
      elapsed < config.sessionKeepaliveCatchUpMs
    ) {
      return;
    }

    snipeLog("[session_keepalive]", { action: "catchup", elapsedMs: elapsed });
    void runSessionKeepalivePulse("catchup");
  }

  function stopKeepaliveTimer() {
    if (keepaliveTimerId == null) {
      return;
    }
    clearInterval(keepaliveTimerId);
    keepaliveTimerId = null;
  }

  function syncKeepaliveTimer() {
    if (!state.settings.keepSessionAlive) {
      stopKeepaliveTimer();
      return;
    }
    if (keepaliveTimerId != null) {
      return;
    }
    keepaliveTimerId = setInterval(
      () => void runSessionKeepalivePulse("interval"),
      config.sessionKeepaliveIntervalMs,
    );
    if (!state.lastSessionKeepaliveAtMs) {
      void runSessionKeepalivePulse("initial");
    }
  }

  function markWakeLockReleased() {
    if (!wakeLockHeld) {
      return;
    }
    wakeLockHeld = false;
    snipeLog("[session_wake_lock]", { action: "released" });
  }

  function releaseWakeLock() {
    if (!wakeLockSentinel) {
      return;
    }
    void wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
    markWakeLockReleased();
  }

  async function acquireWakeLockIfNeeded() {
    if (
      !state.settings.keepScreenAwake ||
      document.visibilityState !== "visible" ||
      !navigator.wakeLock?.request ||
      wakeLockSentinel
    ) {
      return;
    }

    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
        markWakeLockReleased();
      });
      wakeLockHeld = true;
      snipeLog("[session_wake_lock]", { action: "acquired" });
    } catch (error) {
      snipeLog("[session_wake_lock]", {
        action: "failed",
        error: error?.message || String(error),
      });
    }
  }

  function shouldProtectTab() {
    if (!state.settings.warnBeforeClose) {
      return false;
    }
    if (state.simulatedPassTimeMs) {
      return true;
    }
    const passTimes = api.getParsedPassTimes();
    if (passTimes.length) {
      return isSnipingArmed(passTimes);
    }
    try {
      return !!guardWindow.document.getElementById("PassTimesContainer");
    } catch {
      return !!document.getElementById("PassTimesContainer");
    }
  }

  function syncCloseWarning() {
    const protect = shouldProtectTab();

    if (protect && !beforeUnloadHandler) {
      beforeUnloadHandler = (event) => {
        if (reloadIntent) {
          snipeLog("[session_close_warning]", { action: "skipped_reload" });
          return;
        }
        snipeLog("[session_close_warning]", { action: "prompt" });
        event.preventDefault();
        event.returnValue = config.sessionCloseWarningMessage;
        return config.sessionCloseWarningMessage;
      };
      guardWindow.addEventListener("beforeunload", beforeUnloadHandler);
    } else if (!protect && beforeUnloadHandler) {
      guardWindow.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadHandler = null;
    }

    if (protect !== closeWarningActive) {
      closeWarningActive = protect;
      snipeLog("[session_close_warning]", {
        action: protect ? "enabled" : "disabled",
      });
    }
  }

  function syncSessionGuard(armed) {
    if (window.self !== guardWindow) {
      return;
    }

    handleSessionExpiryModal(armed);
    syncCloseWarning();

    if (armed !== sessionGuardActive) {
      sessionGuardActive = armed;
      snipeLog("[session_guard]", {
        action: armed ? "armed" : "disarmed",
        ...(armed
          ? {
              keepSessionAlive: state.settings.keepSessionAlive,
              keepScreenAwake: state.settings.keepScreenAwake,
              warnBeforeClose: state.settings.warnBeforeClose,
            }
          : {}),
      });
    }

    if (!armed) {
      stopKeepaliveTimer();
      releaseWakeLock();
      return;
    }

    syncKeepaliveTimer();
    if (state.settings.keepScreenAwake) {
      void acquireWakeLockIfNeeded();
    } else {
      releaseWakeLock();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      catchUpSessionKeepaliveIfNeeded();
      if (sessionGuardActive && state.settings.keepScreenAwake) {
        void acquireWakeLockIfNeeded();
      }
      return;
    }
    releaseWakeLock();
  });

  window.addEventListener("pagehide", () => {
    sessionGuardActive = false;
    stopKeepaliveTimer();
    releaseWakeLock();
  });

  Object.assign(api, {
    isSnipingArmed,
    runSessionKeepalivePulse,
    catchUpSessionKeepaliveIfNeeded,
    syncSessionGuard,
  });
})();
