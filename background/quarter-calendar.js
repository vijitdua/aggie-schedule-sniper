importScripts("../shared/config-schema.js", "./rmp.js");

const CACHE_KEY = "assQuarterCalendarCache";
const ADVANCED_KEY = "assAdvancedConfig";

function log(event, detail) {
  console.log("[ass:quarter-calendar]", event, detail ?? "");
}

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cellText(html) {
  return normalizeText(html.replace(/<[^>]*>/g, " "));
}

async function loadConfig() {
  const defaults = ASS_CONFIG_SCHEMA.DEFAULT_CONFIG;
  const stored = await chrome.storage.local.get(ADVANCED_KEY);
  return { ...defaults, ...(stored[ADVANCED_KEY] || {}) };
}

function rowMatcher(pattern) {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function termNameToColumn(termName, config) {
  let regex;
  try {
    regex = new RegExp(config.termNameToColumnRegex, "i");
  } catch {
    regex = /(Fall|Winter|Spring|Summer)\b.*?\b(20\d{2})\b/i;
  }
  const match = normalizeText(termName).match(regex);
  if (!match) {
    return null;
  }
  return `${match[1]} ${match[2]}`;
}

function parseRegistrarHtml(html, config) {
  const quarters = {};
  const matchers = {
    instructionBegins: rowMatcher(config.quarterRowInstructionBeginsRegex),
    instructionEnds: rowMatcher(config.quarterRowInstructionEndsRegex),
    finalExaminations: rowMatcher(config.quarterRowFinalExamsRegex),
    quarterEnds: rowMatcher(config.quarterRowQuarterEndsRegex),
  };

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tables) {
    const rowBlocks = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rowBlocks.length < 2) {
      continue;
    }

    const headerCells = [...rowBlocks[0][1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
      .map((match) => cellText(match[1]))
      .filter(Boolean);
    const columns = headerCells.slice(1);
    if (!columns.length) {
      continue;
    }

    for (const column of columns) {
      if (!quarters[column]) {
        quarters[column] = {};
      }
    }

    for (let rowIndex = 1; rowIndex < rowBlocks.length; rowIndex += 1) {
      const cells = [...rowBlocks[rowIndex][1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map((match) => cellText(match[1]));
      const label = cells[0] || "";
      for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
        const column = columns[colIndex];
        const value = cells[colIndex + 1];
        if (!value) {
          continue;
        }
        if (matchers.instructionBegins?.test(label)) {
          quarters[column].instructionBegins = value;
        } else if (matchers.instructionEnds?.test(label)) {
          quarters[column].instructionEnds = value;
        } else if (matchers.finalExaminations?.test(label)) {
          quarters[column].finalExaminations = value;
        } else if (matchers.quarterEnds?.test(label)) {
          quarters[column].quarterEnds = value;
        }
      }
    }
  }

  return quarters;
}

async function readCache() {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  return stored[CACHE_KEY] || null;
}

async function writeCache(quarters, source) {
  const payload = { fetchedAt: Date.now(), source, quarters };
  await chrome.storage.local.set({ [CACHE_KEY]: payload });
  return payload;
}

async function clearCache() {
  await chrome.storage.local.remove(CACHE_KEY);
  log("cache_cleared");
}

async function fetchFreshQuarters(config) {
  const url = config.registrarCalendarUrl;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`registrar fetch failed: ${response.status}`);
  }
  const html = await response.text();
  const quarters = parseRegistrarHtml(html, config);
  if (!Object.keys(quarters).length) {
    throw new Error("registrar parse returned no quarters");
  }
  log("fetch_ok", { url, quarterCount: Object.keys(quarters).length });
  return writeCache(quarters, "registrar");
}

async function getQuarterCalendarData(forceRefresh = false) {
  const config = await loadConfig();
  const ttlMs = Number(config.quarterCacheTtlMs) || 30 * 24 * 60 * 60 * 1000;
  const cached = await readCache();
  const stale =
    !cached?.fetchedAt || Date.now() - cached.fetchedAt > ttlMs;

  if (!forceRefresh && cached?.quarters && Object.keys(cached.quarters).length && !stale) {
    return cached;
  }

  try {
    return await fetchFreshQuarters(config);
  } catch (error) {
    log("fetch_failed", { error: String(error) });
    if (cached?.quarters && Object.keys(cached.quarters).length) {
      return { ...cached, source: `${cached.source}-stale`, error: String(error) };
    }
    throw error;
  }
}

function buildBoundsForTerm(termName, quarters, config) {
  const column = termNameToColumn(termName, config);
  if (!column || !quarters[column]) {
    return {
      ok: false,
      termName,
      registrarColumn: column,
      error: column ? `no registrar data for ${column}` : "could not map term name",
    };
  }

  const row = quarters[column];
  return {
    ok: true,
    termName,
    registrarColumn: column,
    source: "registrar",
    instructionBegins: row.instructionBegins || null,
    instructionEnds: row.instructionEnds || row.quarterEnds || null,
    finalExaminations: row.finalExaminations || null,
    quarterEnds: row.quarterEnds || null,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ASS_GET_QUARTER_BOUNDS") {
    void (async () => {
      try {
        const config = await loadConfig();
        const data = await getQuarterCalendarData(!!message.forceRefresh);
        const bounds = buildBoundsForTerm(message.termName, data.quarters, config);
        sendResponse({
          ok: bounds.ok,
          bounds,
          cache: { fetchedAt: data.fetchedAt, source: data.source },
        });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "ASS_REFETCH_QUARTER_CALENDAR") {
    void (async () => {
      try {
        const config = await loadConfig();
        const data = await fetchFreshQuarters(config);
        sendResponse({ ok: true, cache: data });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "ASS_CLEAR_QUARTER_CALENDAR_CACHE") {
    void (async () => {
      try {
        await clearCache();
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "ASS_LOOKUP_PROFESSOR") {
    void ASS_RMP.handleLookup(message, sendResponse, loadConfig);
    return true;
  }

  if (message?.type === "ASS_CLEAR_RMP_CACHE") {
    void (async () => {
      try {
        await chrome.storage.local.remove(["assRmpCache", "assRmpMiss"]);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  return false;
});
