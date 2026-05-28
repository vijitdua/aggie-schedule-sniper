(() => {
  const ASS = window.ASS;
  const DBG =
    ASS.branding.debugPrefix || ASS.branding.shareUrl || "Aggie Schedule Sniper";
  const DEBUG_LOG = ASS.debug;
  const extensionOk = () => window.ASS_EXTENSION?.extensionOk?.() ?? true;

  function safeJsonForLog(value) {
    if (value === undefined) {
      return "";
    }
    try {
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function pushDebugLogLine(level, event, detailJson) {
    const iso = new Date().toISOString();
    const line = `${iso} ${level} ${event}${detailJson ? ` ${detailJson}` : ""}`;
    DEBUG_LOG.ring.push(line);
    if (DEBUG_LOG.ring.length > DEBUG_LOG.maxRing) {
      DEBUG_LOG.ring.splice(0, DEBUG_LOG.ring.length - DEBUG_LOG.maxRing);
    }
    scheduleDebugPersist();
  }

  function scheduleDebugPersist() {
    if (!extensionOk() || DEBUG_LOG.persistTimerId != null) {
      return;
    }
    DEBUG_LOG.persistTimerId = setTimeout(() => {
      DEBUG_LOG.persistTimerId = null;
      flushDebugLogsToStorage();
    }, DEBUG_LOG.persistDebounceMs);
  }

  function flushDebugLogsToStorage() {
    if (!extensionOk()) {
      return;
    }
    const key = `${DEBUG_LOG.storageKeyPrefix}${DEBUG_LOG.instanceId}`;
    chrome.storage.local.set({
      [key]: {
        updatedAt: Date.now(),
        href: location.href,
        isTopFrame: window.self === window.top,
        lines: DEBUG_LOG.ring.slice(),
      },
    });
  }

  function buildDebugExportText(done) {
    const manifest = chrome.runtime.getManifest?.() || {};
    const header = [
      "=== Aggie Schedule Sniper (extension-scoped logs only) ===",
      `extensionVersion: ${manifest.version ?? "unknown"}`,
      `extensionName: ${manifest.name ?? ""}`,
      `pageHref: ${location.href}`,
      `isTopFrame: ${window.self === window.top}`,
      `timeZone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
      "Note: Page/app console output is not included (content script isolated world).",
      "=== log lines ===",
    ].join("\n");

    if (!extensionOk()) {
      done(`${header}\n${DEBUG_LOG.ring.join("\n")}`);
      return;
    }

    chrome.storage.local.get(null, (all) => {
      if (chrome.runtime.lastError) {
        done(`${header}\n(storage read failed: ${chrome.runtime.lastError.message})`);
        return;
      }
      const merged = [];
      for (const [k, v] of Object.entries(all || {})) {
        if (!k.startsWith(DEBUG_LOG.storageKeyPrefix) || !v?.lines) {
          continue;
        }
        merged.push(...v.lines);
      }
      for (const line of DEBUG_LOG.ring) {
        merged.push(line);
      }
      merged.sort();
      const seen = new Set();
      const deduped = [];
      for (const line of merged) {
        if (seen.has(line)) {
          continue;
        }
        seen.add(line);
        deduped.push(line);
      }
      done(`${header}\n${deduped.join("\n")}`);
    });
  }

  function hydrateDebugLogsFromStorage() {
    if (!extensionOk()) {
      return;
    }
    const key = `${DEBUG_LOG.storageKeyPrefix}${DEBUG_LOG.instanceId}`;
    chrome.storage.local.get([key], (r) => {
      if (chrome.runtime.lastError) {
        return;
      }
      const block = r?.[key];
      if (block?.lines?.length) {
        DEBUG_LOG.ring = block.lines.slice(-DEBUG_LOG.maxRing);
      }
    });
  }

  function pruneStaleDebugStorageKeys() {
    if (!extensionOk()) {
      return;
    }
    const maxAgeMs = 48 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;
    chrome.storage.local.get(null, (all) => {
      if (!all || chrome.runtime.lastError) {
        return;
      }
      const remove = [];
      for (const [k, v] of Object.entries(all)) {
        if (
          k.startsWith(DEBUG_LOG.storageKeyPrefix) &&
          typeof v?.updatedAt === "number" &&
          v.updatedAt < cutoff
        ) {
          remove.push(k);
        }
      }
      if (remove.length) {
        chrome.storage.local.remove(remove);
      }
    });
  }

  function snipeLog(event, detail) {
    const detailJson =
      arguments.length >= 2 ? safeJsonForLog(detail) : "";
    pushDebugLogLine("INFO", event, detailJson);
    if (arguments.length >= 2) {
      console.log(DBG, event, detail);
    } else {
      console.log(DBG, event);
    }
  }

  function assConsoleError(...args) {
    const text = args
      .map((a) => {
        if (a instanceof Error) {
          return a.stack || a.message || String(a);
        }
        return typeof a === "object" ? safeJsonForLog(a) : String(a);
      })
      .join(" ");
    pushDebugLogLine("ERROR", "[console.error]", text);
    console.error(...args);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ASS_EXPORT_LOGS") {
      flushDebugLogsToStorage();
      if (window.self !== window.top) {
        return false;
      }
      setTimeout(() => {
        buildDebugExportText((text) => {
          sendResponse({ ok: true, text });
        });
      }, 120);
      return true;
    }

    if (message?.type === "ASS_SHOW_ONBOARDING") {
      if (window.self !== window.top) {
        sendResponse({ ok: false });
        return false;
      }
      window.ASS?.api?.showOnboardingModal?.();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ASS_OPEN_DEV_MENU") {
      if (window.self !== window.top) {
        sendResponse({ ok: false });
        return false;
      }
      window.ASS?.api?.openDeveloperPanel?.();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  ASS.api.snipeLog = snipeLog;
  ASS.api.assConsoleError = assConsoleError;
  ASS.api.flushDebugLogsToStorage = flushDebugLogsToStorage;
  ASS.api.buildDebugExportText = buildDebugExportText;
  ASS.api.safeJsonForLog = safeJsonForLog;

  hydrateDebugLogsFromStorage();
  pruneStaleDebugStorageKeys();
})();
