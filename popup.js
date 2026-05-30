const branding = window.ASS_BRANDING || {};
const SHARE_URL = branding.shareUrl || "https://ass.vijit.app";
const ADVANCED_STORAGE_KEY = "assAdvancedConfig";

const sniperToggle = document.getElementById("sniperToggle");
const countdownToggle = document.getElementById("countToggle");
const waitingHelpersToggle = document.getElementById("waitingHelpersToggle");
const professorRatingsToggle = document.getElementById("professorRatingsToggle");
const exportCalendarBtn = document.getElementById("exportCalendarBtn");
const modeBadge = document.getElementById("modeBadge");
const shareBtn = document.getElementById("shareBtn");
const infoBtn = document.getElementById("infoBtn");
const copyDebugBtn = document.getElementById("copyDebugBtn");
const popupVersion = document.getElementById("popupVersion");
const mainShell = document.getElementById("mainShell");
const devShell = document.getElementById("devShell");
const closeDevBtn = document.getElementById("closeDevBtn");
const snackbar = document.getElementById("snackbar");
const advancedFields = document.getElementById("advancedFields");
const resetAdvancedBtn = document.getElementById("resetAdvancedBtn");
const resetAdvancedTopBtn = document.getElementById("resetAdvancedTopBtn");
const devAutoRegisterToggle = document.getElementById("devAutoRegisterToggle");
const devShowCountdownToggle = document.getElementById("devShowCountdownToggle");
const devKeepLoggedInToggle = document.getElementById("devKeepLoggedInToggle");
const devProfessorRatingsToggle = document.getElementById("devProfessorRatingsToggle");
const isEmbedded = new URLSearchParams(location.search).get("embedded") === "1";
const isDeveloperPage =
  new URLSearchParams(location.search).get("developer") === "1";

const DEFAULT_SETTINGS = {
  autoRegister: true,
  showCountdown: true,
  keepSessionAlive: true,
  keepScreenAwake: true,
  showProfessorRatings: true,
};

let snackbarTimer = 0;
let versionClickCount = 0;
let versionClickTimer = 0;

if (isEmbedded) {
  document.body.classList.add("embedded");
}
if (isDeveloperPage) {
  document.body.classList.add("dev-page");
}

if (isDeveloperPage) {
  if (mainShell) {
    mainShell.hidden = true;
  }
  if (devShell) {
    devShell.hidden = false;
  }
  buildAdvancedFields();
  initializeDeveloperPage();
} else {
  showExtensionVersion();
  initializePopup();
}

function showExtensionVersion() {
  if (!popupVersion) {
    return;
  }
  const version = chrome.runtime.getManifest?.().version;
  popupVersion.textContent = version ? `v${version}` : "";
  popupVersion.addEventListener("click", () => {
    versionClickCount += 1;
    clearTimeout(versionClickTimer);
    versionClickTimer = setTimeout(() => {
      versionClickCount = 0;
    }, 700);
    if (versionClickCount >= 3) {
      versionClickCount = 0;
      void openDeveloperMenu();
    }
  });
}

async function openDeveloperMenu() {
  if (isEmbedded && window.parent !== window) {
    window.parent.postMessage({ type: "ASS_OPEN_DEV_MENU" }, "*");
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      showSnackbar("No active tab", "error");
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: "ASS_OPEN_DEV_MENU" });
    window.close();
  } catch {
    showSnackbar("Open Schedule Builder on this tab first", "error");
  }
}

function initializeDeveloperPage() {
  initializeDevUserToggles();

  closeDevBtn?.addEventListener("click", () => {
    if (isEmbedded && window.parent !== window) {
      window.parent.postMessage({ type: "ASS_CLOSE_DEV_MENU" }, "*");
      return;
    }
    window.close();
  });

  resetAdvancedBtn?.addEventListener("click", resetAdvancedOverrides);
  resetAdvancedTopBtn?.addEventListener("click", resetAdvancedOverrides);
}

function resetAdvancedOverrides() {
  chrome.storage.local.remove(ADVANCED_STORAGE_KEY, () => {
    buildAdvancedFields();
    showSnackbar("Advanced settings reset", "success");
  });
}

function refetchRegistrarCalendar() {
  if (!chrome.runtime?.id) {
    showSnackbar("Reload the extension, then try again", "error");
    return;
  }
  chrome.runtime.sendMessage({ type: "ASS_REFETCH_QUARTER_CALENDAR" }, (res) => {
    if (chrome.runtime.lastError) {
      showSnackbar(chrome.runtime.lastError.message, "error");
      return;
    }
    if (res?.ok) {
      showSnackbar("Quarter calendar refetched", "success");
    } else {
      showSnackbar(res?.error || "Refetch failed", "error");
    }
  });
}

function clearRegistrarCalendarCache() {
  if (!chrome.runtime?.id) {
    showSnackbar("Reload the extension, then try again", "error");
    return;
  }
  chrome.runtime.sendMessage({ type: "ASS_CLEAR_QUARTER_CALENDAR_CACHE" }, (res) => {
    if (chrome.runtime.lastError) {
      showSnackbar(chrome.runtime.lastError.message, "error");
      return;
    }
    if (res?.ok) {
      showSnackbar("Registrar cache cleared", "success");
    } else {
      showSnackbar(res?.error || "Clear cache failed", "error");
    }
  });
}

function clearRmpCache() {
  if (!chrome.runtime?.id) {
    showSnackbar("Reload the extension, then try again", "error");
    return;
  }
  chrome.runtime.sendMessage({ type: "ASS_CLEAR_RMP_CACHE" }, (res) => {
    if (chrome.runtime.lastError) {
      showSnackbar(chrome.runtime.lastError.message, "error");
      return;
    }
    if (res?.ok) {
      showSnackbar("RMP cache cleared", "success");
    } else {
      showSnackbar(res?.error || "Clear cache failed", "error");
    }
  });
}

function initializeDevUserToggles() {
  if (
    !devAutoRegisterToggle ||
    !devShowCountdownToggle ||
    !devKeepLoggedInToggle ||
    !devProfessorRatingsToggle
  ) {
    return;
  }

  const applySyncSettings = (saved) => {
    devAutoRegisterToggle.checked = !!saved.autoRegister;
    devShowCountdownToggle.checked = !!saved.showCountdown;
    devKeepLoggedInToggle.checked = isWaitingHelpersEnabled(saved);
    devProfessorRatingsToggle.checked = saved.showProfessorRatings !== false;
  };

  chrome.storage.sync.get(DEFAULT_SETTINGS, applySyncSettings);

  devAutoRegisterToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoRegister: devAutoRegisterToggle.checked });
  });

  devShowCountdownToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ showCountdown: devShowCountdownToggle.checked });
  });

  devKeepLoggedInToggle.addEventListener("change", () => {
    setWaitingHelpers(devKeepLoggedInToggle.checked);
  });

  devProfessorRatingsToggle.addEventListener("change", () => {
    chrome.storage.sync.set({
      showProfessorRatings: devProfessorRatingsToggle.checked,
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }
    chrome.storage.sync.get(DEFAULT_SETTINGS, applySyncSettings);
  });
}

function fieldDisplayValue(field, saved, defaults) {
  const raw = saved[field.key];
  const current =
    raw === undefined || raw === null || raw === ""
      ? defaults[field.key]
      : raw;
  return Array.isArray(current) ? current.join(",") : String(current);
}

function createAdvancedField(field, saved, defaults) {
  const wrap = document.createElement("div");
  wrap.className = "advanced-field";

  const labelRow = document.createElement("div");
  labelRow.className = "advanced-field-label-row";

  const label = document.createElement("label");
  label.textContent = field.label;
  label.htmlFor = `adv-${field.key}`;

  const helpWrap = document.createElement("span");
  helpWrap.className = "field-help-wrap";
  helpWrap.tabIndex = 0;
  helpWrap.setAttribute("aria-describedby", `adv-help-${field.key}`);
  helpWrap.innerHTML =
    '<span class="field-help-icon" aria-hidden="true">?</span>' +
    `<span class="setting-tooltip dev-field-tooltip" id="adv-help-${field.key}" role="tooltip">${field.help || ""}</span>`;

  labelRow.append(label, helpWrap);

  const input = document.createElement("input");
  input.id = `adv-${field.key}`;
  input.type = field.type === "number" ? "number" : "text";
  input.value = fieldDisplayValue(field, saved, defaults);
  input.placeholder = String(defaults[field.key] ?? "");

  const hint = document.createElement("small");
  hint.textContent = `Default: ${defaults[field.key]}`;

  input.addEventListener("change", () => {
    const trimmed = input.value.trim();
    if (!trimmed || trimmed === String(defaults[field.key])) {
      removeAdvancedField(field.key);
      input.value = fieldDisplayValue(field, {}, defaults);
      return;
    }
    saveAdvancedField(field.key, input.value);
  });

  wrap.append(labelRow, input, hint);
  return wrap;
}

function removeAdvancedField(key) {
  chrome.storage.local.get([ADVANCED_STORAGE_KEY], (result) => {
    const next = { ...(result[ADVANCED_STORAGE_KEY] || {}) };
    delete next[key];
    const hasKeys = Object.keys(next).length > 0;
    if (hasKeys) {
      chrome.storage.local.set({ [ADVANCED_STORAGE_KEY]: next });
    } else {
      chrome.storage.local.remove(ADVANCED_STORAGE_KEY);
    }
  });
}

function buildAdvancedFields() {
  const schema = window.ASS_CONFIG_SCHEMA;
  if (!schema || !advancedFields) {
    return;
  }

  chrome.storage.local.get([ADVANCED_STORAGE_KEY], (result) => {
    const saved = result[ADVANCED_STORAGE_KEY] || {};
    advancedFields.innerHTML = "";

    for (const group of schema.GROUPS) {
      const groupFields = schema.FIELDS.filter((field) => field.group === group.id);
      if (!groupFields.length) {
        continue;
      }

      const section = document.createElement("section");
      section.className = "dev-config-group";

      const header = document.createElement("div");
      header.className = "dev-group-header";
      header.innerHTML = `<h3 class="dev-group-title">${group.title}</h3><p class="dev-group-desc">${group.description}</p>`;
      section.appendChild(header);

      if (group.id === "calendar") {
        const note = document.createElement("div");
        note.className = "dev-calendar-note";
        note.innerHTML = [
          "<p><strong>Why registrar?</strong> Weekly class events need instruction begin/end for RRULE recurrence.</p>",
          "<p><strong>Finals:</strong> Each course's final date comes from Schedule Builder (course card), not the registrar finals week row.</p>",
          "<p><strong>Backup:</strong> If fetch/parse fails with no cache left, export prompts for quarter dates on each export (not saved).</p>",
          "<p><strong>Testing failures:</strong> Refetch always hits the live URL. Export may still use cached dates until you clear the cache.</p>",
        ].join("");
        section.appendChild(note);

        const calendarActions = document.createElement("div");
        calendarActions.className = "dev-calendar-actions";

        const refetchBtn = document.createElement("button");
        refetchBtn.type = "button";
        refetchBtn.className = "advanced-btn";
        refetchBtn.textContent = "Refetch registrar calendar";
        refetchBtn.addEventListener("click", refetchRegistrarCalendar);

        const clearCacheBtn = document.createElement("button");
        clearCacheBtn.type = "button";
        clearCacheBtn.className = "advanced-btn advanced-btn--danger";
        clearCacheBtn.textContent = "Clear registrar cache";
        clearCacheBtn.addEventListener("click", clearRegistrarCalendarCache);

        calendarActions.append(refetchBtn, clearCacheBtn);
        section.appendChild(calendarActions);
      }

      if (group.id === "professor_ratings") {
        const rmpActions = document.createElement("div");
        rmpActions.className = "dev-calendar-actions";

        const clearRmpBtn = document.createElement("button");
        clearRmpBtn.type = "button";
        clearRmpBtn.className = "advanced-btn advanced-btn--danger";
        clearRmpBtn.textContent = "Clear RMP cache";
        clearRmpBtn.addEventListener("click", clearRmpCache);

        rmpActions.appendChild(clearRmpBtn);
        section.appendChild(rmpActions);
      }

      const grid = document.createElement("div");
      grid.className = "advanced-fields";

      for (const field of groupFields) {
        grid.appendChild(createAdvancedField(field, saved, schema.DEFAULT_CONFIG));
      }

      section.appendChild(grid);
      advancedFields.appendChild(section);
    }
  });
}

function saveAdvancedField(key, value) {
  chrome.storage.local.get([ADVANCED_STORAGE_KEY], (result) => {
    const next = { ...(result[ADVANCED_STORAGE_KEY] || {}), [key]: value };
    chrome.storage.local.set({ [ADVANCED_STORAGE_KEY]: next });
  });
}

function isWaitingHelpersEnabled(saved) {
  return !!saved.keepSessionAlive && !!saved.keepScreenAwake;
}

function setWaitingHelpers(enabled) {
  chrome.storage.sync.set({
    keepSessionAlive: enabled,
    keepScreenAwake: enabled,
  });
}

function initializePopup() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (saved) => {
    sniperToggle.checked = !!saved.autoRegister;
    countdownToggle.checked = !!saved.showCountdown;
    waitingHelpersToggle.checked = isWaitingHelpersEnabled(saved);
    if (professorRatingsToggle) {
      professorRatingsToggle.checked = saved.showProfessorRatings !== false;
    }
    updateModeBadge();
  });

  sniperToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoRegister: sniperToggle.checked });
    updateModeBadge();
  });

  countdownToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ showCountdown: countdownToggle.checked });
    updateModeBadge();
  });

  waitingHelpersToggle.addEventListener("change", () => {
    setWaitingHelpers(waitingHelpersToggle.checked);
    updateModeBadge();
  });

  professorRatingsToggle?.addEventListener("change", () => {
    chrome.storage.sync.set({
      showProfessorRatings: professorRatingsToggle.checked,
    });
    updateModeBadge();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.showProfessorRatings || !professorRatingsToggle) {
      return;
    }
    professorRatingsToggle.checked = changes.showProfessorRatings.newValue !== false;
  });

  shareBtn.addEventListener("click", () => {
    void shareLink();
  });

  infoBtn.addEventListener("click", () => {
    void showOnboarding();
  });

  copyDebugBtn.addEventListener("click", () => {
    void copyDebugLogsFromPage();
  });

  exportCalendarBtn.addEventListener("click", () => {
    void exportCalendarFromPage();
  });
}

async function showOnboarding() {
  if (isEmbedded && window.parent !== window) {
    window.parent.postMessage({ type: "ASS_SHOW_ONBOARDING" }, "*");
    return;
  }

  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];
    if (!tab?.id) {
      showSnackbar("No active tab", "error");
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "ASS_SHOW_ONBOARDING",
    });
    if (!res?.ok) {
      showSnackbar("Open Schedule Builder on this tab, then try again", "error");
    }
  } catch {
    showSnackbar("Open Schedule Builder on this tab, then try again", "error");
  }
}

async function shareLink() {
  const copied = await copyStringToClipboard(SHARE_URL);
  if (copied) {
    showSnackbar("Copied to your clipboard", "success");
  } else {
    showSnackbar("Couldn't copy link", "error");
  }
}

async function copyStringToClipboard(text) {
  if (window.ASS_CLIPBOARD) {
    return window.ASS_CLIPBOARD.copyText(text);
  }
  return false;
}

async function copyDebugLogsFromPage() {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];
    if (!tab?.id) {
      showSnackbar("No active tab", "error");
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "ASS_EXPORT_LOGS",
    });
    if (!res?.ok || typeof res.text !== "string" || !res.text.length) {
      showSnackbar("Load Schedule Builder on this tab, then try again", "error");
      return;
    }
    const copied = await copyStringToClipboard(res.text);
    if (copied) {
      showSnackbar("Debug logs copied", "success");
    } else {
      showSnackbar("Could not copy to clipboard", "error");
    }
  } catch {
    showSnackbar("Open Schedule Builder on this tab, then try again", "error");
  }
}

async function exportCalendarFromPage() {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];
    if (!tab?.id) {
      showSnackbar("No active tab", "error");
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "ASS_EXPORT_CALENDAR",
    });
    if (!res?.ok && res?.error) {
      showSnackbar(res.error, "error");
    }
  } catch {
    showSnackbar("Open Schedule Builder on this tab, then try again", "error");
  }
}

function showSnackbar(message, kind) {
  snackbar.textContent = message;
  snackbar.classList.remove("snackbar--success", "snackbar--error");
  snackbar.classList.add(kind === "success" ? "snackbar--success" : "snackbar--error");
  snackbar.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  snackbar.hidden = false;
  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(() => {
    snackbar.hidden = true;
  }, 3200);
}

function updateModeBadge() {
  modeBadge.textContent = "";
}
