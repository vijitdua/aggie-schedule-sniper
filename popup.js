const branding = window.ASS_BRANDING || {};
const SHARE_URL = branding.shareUrl || "https://ass.vijit.app";

const sniperToggle = document.getElementById("sniperToggle");
const countdownToggle = document.getElementById("countToggle");
const modeBadge = document.getElementById("modeBadge");
const shareBtn = document.getElementById("shareBtn");
const infoBtn = document.getElementById("infoBtn");
const copyDebugBtn = document.getElementById("copyDebugBtn");
const popupVersion = document.getElementById("popupVersion");
const snackbar = document.getElementById("snackbar");
const isEmbedded = new URLSearchParams(location.search).get("embedded") === "1";

let snackbarTimer = 0;

if (isEmbedded) {
  document.body.classList.add("embedded");
}

showExtensionVersion();
initializePopup();

function showExtensionVersion() {
  if (!popupVersion) {
    return;
  }
  const version = chrome.runtime.getManifest?.().version;
  popupVersion.textContent = version ? `v${version}` : "";
}

function initializePopup() {
  chrome.storage.sync.get({ autoRegister: true, showCountdown: true }, saved => {
    sniperToggle.checked = !!saved.autoRegister;
    countdownToggle.checked = !!saved.showCountdown;
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

  shareBtn.addEventListener("click", () => {
    void shareLink();
  });

  infoBtn.addEventListener("click", () => {
    void showOnboarding();
  });

  copyDebugBtn.addEventListener("click", () => {
    void copyDebugLogsFromPage();
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
