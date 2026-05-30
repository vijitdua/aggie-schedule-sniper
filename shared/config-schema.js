/**
 * Default config schema for Advanced / Developer Menu.
 */
(function (root) {
  const DEFAULT_CONFIG = {
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
    sessionContinueButtonTextRegex: "^continue\\s+session$",
    sessionContinueClickCooldownMs: 3000,
    clickRetryBackoffMs: "250,500,1000,2000,3000",
    passTimeRegex:
      "Pass\\s*(\\d+)\\s*:\\s*([A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4}\\s+\\d{1,2}:\\d{2}\\s*(AM|PM))",
    registerButtonSelector:
      "a.register_trigger, a, button, input[type='button'], input[type='submit']",
    registerButtonTextRegex: "\\bregister\\b",
    excludedButtonTextRegex: "pre-check",
    scheduleCourseSelector:
      "#SavedSchedulesListDisplayContainer article.CourseItem",
    registrarCalendarUrl: "https://registrar.ucdavis.edu/calendar/quarter",
    quarterCacheTtlMs: 2592000000,
    termNameToColumnRegex: "(Fall|Winter|Spring|Summer)\\b.*?(20\\d{2})",
    quarterRowInstructionBeginsRegex: "instruction begins",
    quarterRowInstructionEndsRegex: "instruction ends",
    quarterRowFinalExamsRegex: "final examinations",
    quarterRowQuarterEndsRegex: "quarter ends",
    onboardingStorageKey: "assOnboardingDismissed_v2",
  };

  const GROUPS = [
    {
      id: "registration",
      title: "Registration & pass times",
      description:
        "How the extension finds pass times and clicks Register on Schedule Builder.",
    },
    {
      id: "session",
      title: "Keep logged in",
      description:
        "Background pings and Continue Session modal handling while Schedule Builder is open.",
    },
    {
      id: "calendar",
      title: "Calendar export",
      description:
        "Weekly .ics events repeat from instruction begin → instruction end (from the registrar table). Per-course final exams come from Schedule Builder course cards — not the registrar finals week range.",
    },
    {
      id: "ui",
      title: "UI & timing",
      description:
        "Overlay refresh rate and embedded settings panel size on Schedule Builder.",
    },
    {
      id: "general",
      title: "General",
      description: "Miscellaneous storage keys and messages.",
    },
  ];

  const FIELDS = [
    {
      key: "passTimeRegex",
      label: "Pass time regex",
      type: "string",
      group: "registration",
      help: "Regex matched against page text to find each pass number and open datetime.",
    },
    {
      key: "passActiveWindowMs",
      label: "Pass active window (ms)",
      type: "number",
      group: "registration",
      help: "How long after a pass opens the extension keeps trying to register (default 4 hours).",
    },
    {
      key: "passCacheTtlMs",
      label: "Pass cache TTL (ms)",
      type: "number",
      group: "registration",
      help: "How long parsed pass times are cached before re-reading the DOM.",
    },
    {
      key: "registerButtonSelector",
      label: "Register button selector",
      type: "string",
      group: "registration",
      help: "CSS selector for candidate Register / Register ALL buttons.",
    },
    {
      key: "registerButtonTextRegex",
      label: "Register button text regex",
      type: "string",
      group: "registration",
      help: "Button label must match this regex to count as a register action.",
    },
    {
      key: "excludedButtonTextRegex",
      label: "Excluded button text regex",
      type: "string",
      group: "registration",
      help: "Buttons matching this regex are ignored (e.g. Pre-check).",
    },
    {
      key: "clickRetryBackoffMs",
      label: "Register retry backoff (ms)",
      type: "string",
      group: "registration",
      help: "Comma-separated delays between Register click retries.",
    },
    {
      key: "sessionKeepaliveIntervalMs",
      label: "Keepalive interval (ms)",
      type: "number",
      group: "session",
      help: "How often to ping UC Davis while armed on Schedule Builder.",
    },
    {
      key: "sessionKeepaliveCatchUpMs",
      label: "Keepalive catch-up (ms)",
      type: "number",
      group: "session",
      help: "If a ping was missed, retry within this window after the tab becomes active again.",
    },
    {
      key: "sessionContinueButtonSelector",
      label: "Continue Session selector",
      type: "string",
      group: "session",
      help: "CSS selector used to find the UC Davis Continue Session button.",
    },
    {
      key: "sessionContinueButtonTextRegex",
      label: "Continue Session text regex",
      type: "string",
      group: "session",
      help: "Visible button text must match this regex before auto-clicking.",
    },
    {
      key: "sessionContinueClickCooldownMs",
      label: "Continue Session cooldown (ms)",
      type: "number",
      group: "session",
      help: "Minimum time between automatic Continue Session clicks.",
    },
    {
      key: "sessionBkgEndpoint",
      label: "Keepalive endpoint path",
      type: "string",
      group: "session",
      help: "Relative path for the background keepalive POST request.",
    },
    {
      key: "sessionBkgPayload",
      label: "Keepalive POST body",
      type: "string",
      group: "session",
      help: "Form body sent with each keepalive ping.",
    },
    {
      key: "scheduleCourseSelector",
      label: "Schedule course selector",
      type: "string",
      group: "calendar",
      help: "CSS selector for course cards parsed during calendar export.",
    },
    {
      key: "registrarCalendarUrl",
      label: "Registrar calendar URL",
      type: "string",
      group: "calendar",
      help: "HTML page fetched in the background. Parsed tables map term columns (e.g. Fall 2026) to date rows.",
    },
    {
      key: "quarterCacheTtlMs",
      label: "Registrar cache TTL (ms)",
      type: "number",
      group: "calendar",
      help: "How long fetched registrar tables are cached before refetching.",
    },
    {
      key: "termNameToColumnRegex",
      label: "Term name → column regex",
      type: "string",
      group: "calendar",
      help: "Maps SB term label (Fall Quarter 2026) to registrar column header (Fall 2026). Group 1 = season, group 2 = year.",
    },
    {
      key: "quarterRowInstructionBeginsRegex",
      label: "Row label: instruction begins",
      type: "string",
      group: "calendar",
      help: "Table row label regex — cell value becomes weekly event RRULE start date.",
    },
    {
      key: "quarterRowInstructionEndsRegex",
      label: "Row label: instruction ends",
      type: "string",
      group: "calendar",
      help: "Table row label regex — cell value becomes weekly event RRULE end date.",
    },
    {
      key: "quarterRowQuarterEndsRegex",
      label: "Row label: quarter ends",
      type: "string",
      group: "calendar",
      help: "Fallback row if instruction ends is missing.",
    },
    {
      key: "quarterRowFinalExamsRegex",
      label: "Row label: final examinations",
      type: "string",
      group: "calendar",
      help: "Parsed for preview info only. Actual final events use per-course dates from Schedule Builder.",
    },
    {
      key: "renderIntervalMs",
      label: "Overlay refresh interval (ms)",
      type: "number",
      group: "ui",
      help: "How often the overlay re-renders pass-time and status on Schedule Builder.",
    },
    {
      key: "embeddedPanelWidthPx",
      label: "Settings panel width (px)",
      type: "number",
      group: "ui",
      help: "Width of the embedded ⚙ settings panel on Schedule Builder.",
    },
    {
      key: "embeddedPanelHeightPx",
      label: "Settings panel height (px)",
      type: "number",
      group: "ui",
      help: "Height of the embedded ⚙ settings panel on Schedule Builder.",
    },
    {
      key: "onboardingStorageKey",
      label: "Onboarding storage key",
      type: "string",
      group: "general",
      help: "chrome.storage.sync key used to remember onboarding dismissal.",
    },
  ];

  root.ASS_CONFIG_SCHEMA = { DEFAULT_CONFIG, GROUPS, FIELDS };
})(typeof globalThis !== "undefined" ? globalThis : self);
