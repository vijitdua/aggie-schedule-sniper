(() => {
  const branding = window.ASS_BRANDING || {};

  function getUcdTestDelaySecondsFromUrl() {
    const queryValue = new URLSearchParams(location.search).get("ucdTest");
    const hashValue = location.hash.match(/ucdTest=(\d+)/i)?.[1];
    const seconds = Number.parseInt(queryValue || hashValue || "0", 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  function getSimulatedPassTimeMsFromUrl() {
    const sec = getUcdTestDelaySecondsFromUrl();
    return sec != null ? Date.now() + sec * 1000 : null;
  }

  /** Dev helper: ?assReset=1 or #assReset=1 clears first-run onboarding. */
  function shouldResetOnboardingFromUrl() {
    const queryValue = new URLSearchParams(location.search).get("assReset");
    const hashValue = location.hash.match(/assReset=([^&]+)/i)?.[1];
    const token = (queryValue || hashValue || "").toLowerCase();
    return token === "1" || token === "onboarding" || token === "all";
  }

  window.ASS = {
    branding,
    config: {
      embeddedPanelWidthPx: 340,
      embeddedPanelHeightPx: 420,
      renderIntervalMs: 500,
      passActiveWindowMs: 4 * 60 * 60 * 1000,
      passCacheTtlMs: 8000,
      sessionKeepaliveIntervalMs: 18 * 60 * 1000,
      sessionKeepaliveCatchUpMs: 12 * 60 * 1000,
      sessionBkgEndpoint: "/grid1/api/bkg/index.cfm",
      sessionBkgPayload: "loadBkg=true",
      sessionContinueButtonSelector:
        "button, a, input[type='button'], input[type='submit']",
      sessionContinueButtonTextRegex: /^continue\s+session$/i,
      sessionContinueClickCooldownMs: 3000,
      clickRetryBackoffMs: [250, 500, 1000, 2000, 3000],
      passTimeRegex:
        /Pass\s*(\d+)\s*:\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(AM|PM))/gi,
      registerButtonSelector:
        "a.register_trigger, a, button, input[type='button'], input[type='submit']",
      registerButtonTextRegex: /\bregister\b/i,
      excludedButtonTextRegex: /pre-check/i,
      onboardingStorageKey: "assOnboardingDismissed_v3",
      scheduleCourseSelector:
        "#SavedSchedulesListDisplayContainer article.CourseItem",
      registrarCalendarUrl: "https://registrar.ucdavis.edu/calendar/quarter",
    },
    state: {
      settings: {
        autoRegister: true,
        showCountdown: true,
        keepSessionAlive: true,
        keepScreenAwake: true,
        showProfessorRatings: true,
        showAdvancedPlanner: true,
      },
      selectedPassId: null,
      cachedRegisterButton: null,
      renderTimerId: null,
      lastSessionKeepaliveAtMs: 0,
      sessionExpiryWarning: false,
      simulatedPassTimeMs: getSimulatedPassTimeMsFromUrl(),
      passTimeCache: {
        items: [],
        cachedAtMs: 0,
      },
      activationSeenByPassId: new Map(),
      clickAttemptStateByPassId: new Map(),
    },
    ui: {
      root: null,
      launcherButton: null,
      launcherLabel: null,
      countdownChip: null,
      statusChip: null,
      settingsPanel: null,
      devPanel: null,
      devBackdrop: null,
      backdrop: null,
      onboardingRoot: null,
    },
    debug: {
      maxRing: 1024,
      persistDebounceMs: 2500,
      storageKeyPrefix: "assDbgInst_",
      instanceId: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ring: [],
      persistTimerId: null,
    },
    passActivationAnnounced: new Set(),
    startupSnapshotLogged: false,
    api: {},
  };

  window.ASS.api.getUcdTestDelaySecondsFromUrl = getUcdTestDelaySecondsFromUrl;
  window.ASS.api.getSimulatedPassTimeMsFromUrl = getSimulatedPassTimeMsFromUrl;
  window.ASS.api.shouldResetOnboardingFromUrl = shouldResetOnboardingFromUrl;
  window.ASS.api.wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));
})();
