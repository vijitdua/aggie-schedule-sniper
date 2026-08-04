(() => {
  const ASS = window.ASS;
  const { config, api } = ASS;
  const ext = () => window.ASS_EXTENSION?.extensionOk?.() ?? true;

  const CACHE_KEY = "assRmpCache";
  const MISS_KEY = "assRmpMiss";
  const INSTRUCTOR_PATTERN = /^[A-Z]\.\s+\S/;

  let cacheLoaded = false;
  let cacheLoadPromise = null;
  let cacheByName = {};
  let missNames = new Set();
  let observerStarted = false;
  let debounceTimer = null;
  let selfPersisting = false;
  let inFlight = 0;
  const waitQueue = [];
  const lookupByName = new Map();

  function shareUrl() {
    return ASS.branding?.shareUrl || "https://ass.vijit.app";
  }

  function cacheTtlMs() {
    return Number(config.rmpCacheTtlMs) || 7 * 24 * 60 * 60 * 1000;
  }

  function maxConcurrent() {
    return Number(config.rmpMaxConcurrentLookups) || 5;
  }

  function instructorSelector() {
    return (
      config.rmpInstructorSelector ||
      "div.results-instructor a, article.course-container a[href^='mailto:']"
    );
  }

  /** Comma-separated `rmpSearchContainerSelector` plus saved schedule root. */
  function rmpRoots() {
    const seen = new Set();
    const roots = [];
    const add = (node) => {
      if (node && !seen.has(node)) {
        seen.add(node);
        roots.push(node);
      }
    };
    const search =
      config.rmpSearchContainerSelector ||
      "#inlineCourseResultsContainer, [role='dialog']";
    for (const sel of search.split(",")) {
      const trimmed = sel.trim();
      if (trimmed) {
        document.querySelectorAll(trimmed).forEach(add);
      }
    }
    add(
      document.querySelector(
        config.rmpSavedContainerSelector || "#SavedSchedulesListDisplayContainer",
      ),
    );
    return roots;
  }

  function isStaffLabel(text) {
    const value = (text || "").trim();
    return !value.includes(".") || /(^|\s)staff(\s|$)/i.test(value);
  }

  function parseInstructorLabel(text) {
    const value = (text || "").trim();
    if (!INSTRUCTOR_PATTERN.test(value) || isStaffLabel(value)) {
      return null;
    }
    const dotIndex = value.indexOf(". ");
    if (dotIndex < 1) {
      return null;
    }
    return {
      displayName: value,
      firstInitial: value.slice(0, dotIndex).trim(),
      lastName: value.slice(dotIndex + 2).trim(),
    };
  }

  function parseProfessorNameForLookup(text) {
    const parsedLabel = parseInstructorLabel(text);
    if (parsedLabel) {
      return parsedLabel;
    }
    const displayName = (text || "").trim();
    if (
      !displayName ||
      /(^|\s)staff(\s|$)/i.test(displayName) ||
      /(^|\s)tba(\s|$)/i.test(displayName)
    ) {
      return null;
    }
    const commaParts = displayName.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length === 2) {
      return {
        displayName,
        firstInitial: commaParts[1].slice(0, 1),
        lastName: commaParts[0],
      };
    }
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return {
      displayName,
      firstInitial: parts[0].slice(0, 1),
      lastName: parts.slice(1).join(" "),
    };
  }

  function ensureStyles() {
    if (document.getElementById("ass-rmp-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ass-rmp-styles";
    style.textContent = [
      ".ass-rmp{display:block;width:fit-content;max-width:min(100%,280px);margin:8px 0 10px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #ffbf00;border-radius:10px;box-shadow:0 4px 12px rgba(1,37,110,.08);font:400 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#64748b;line-height:1.45;flex:1 1 100%}",
      ".ass-rmp--empty{border-left-color:#cbd5e1;box-shadow:0 2px 8px rgba(1,37,110,.05)}",
      ".ass-rmp__head{margin:0 0 8px;font:700 11px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#01256e;letter-spacing:.02em;text-transform:uppercase}",
      ".ass-rmp__rows{display:flex;flex-direction:column;gap:6px}",
      ".ass-rmp__row{display:flex;align-items:center;justify-content:space-between;gap:12px}",
      ".ass-rmp__label{color:#64748b;font-weight:500;white-space:nowrap}",
      ".ass-rmp__value{font:700 13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:2px 8px;border-radius:999px;white-space:nowrap}",
      ".ass-rmp__value--good{color:#166534;background:#ecfdf5}",
      ".ass-rmp__value--mid{color:#b45309;background:#fffbeb}",
      ".ass-rmp__value--low{color:#991b1b;background:#fef2f2}",
      ".ass-rmp__value--neutral{color:#475569;background:#f8fafc}",
      ".ass-rmp__footer{display:flex;flex-direction:column;gap:3px;margin-top:10px;padding-top:8px;border-top:1px solid #eef2f7}",
      ".ass-rmp__link{color:#01256e;font-weight:600;text-decoration:none}",
      ".ass-rmp__link:hover{text-decoration:underline}",
      ".ass-rmp__via{font-size:10px;color:#94a3b8}",
      ".ass-rmp__via a{color:#94a3b8;text-decoration:none}",
      ".ass-rmp__via a:hover{text-decoration:underline;color:#64748b}",
      ".ass-rmp__message{margin:0;color:#64748b;font-size:12px}",
    ].join("");
    document.head.appendChild(style);
  }

  function ratingTone(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return "neutral";
    }
    if (n >= 4) {
      return "good";
    }
    if (n >= 3) {
      return "mid";
    }
    return "low";
  }

  function wouldTakeTone(value) {
    if (value == null || value < 0) {
      return "neutral";
    }
    if (value >= 70) {
      return "good";
    }
    if (value >= 50) {
      return "mid";
    }
    return "low";
  }

  function difficultyTone(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return "neutral";
    }
    if (n <= 2) {
      return "good";
    }
    if (n <= 3.5) {
      return "mid";
    }
    return "low";
  }

  function createStatRow(label, valueText, tone) {
    const row = document.createElement("div");
    row.className = "ass-rmp__row";

    const labelEl = document.createElement("span");
    labelEl.className = "ass-rmp__label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = `ass-rmp__value ass-rmp__value--${tone || "neutral"}`;
    valueEl.textContent = valueText;

    row.append(labelEl, valueEl);
    return row;
  }

  function createFooterLink(label, href) {
    const link = document.createElement("a");
    link.className = "ass-rmp__link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function formatRating(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }
    return Number(value).toFixed(1);
  }

  function formatPercent(value) {
    if (value == null || value < 0) {
      return "N/A";
    }
    return `${Math.round(value)}%`;
  }

  function renderSignature(state, data) {
    if (state === "loading") {
      return "loading";
    }
    if (state === "miss") {
      return "miss";
    }
    return [
      "hit",
      data?.rating,
      data?.wouldTakeAgainPercent,
      data?.difficulty,
      data?.profileUrl || "",
    ].join("|");
  }

  function renderBlock(container, state, data) {
    const signature = renderSignature(state, data);
    if (container.dataset.assRmpRendered === signature) {
      return false;
    }
    container.dataset.assRmpRendered = signature;
    container.replaceChildren();
    container.classList.remove("ass-rmp--empty");

    if (state === "loading") {
      container.classList.add("ass-rmp--empty");
      const message = document.createElement("p");
      message.className = "ass-rmp__message";
      message.textContent = "Loading reviews…";
      container.appendChild(message);
      return true;
    }

    if (state === "miss") {
      container.classList.add("ass-rmp--empty");
      const message = document.createElement("p");
      message.className = "ass-rmp__message";
      message.textContent = "No RateMyProfessors reviews found";
      container.appendChild(message);
      return true;
    }

    const head = document.createElement("div");
    head.className = "ass-rmp__head";
    head.textContent = "RateMyProfessors";
    container.appendChild(head);

    const rows = document.createElement("div");
    rows.className = "ass-rmp__rows";
    rows.append(
      createStatRow("Rating", formatRating(data.rating), ratingTone(data.rating)),
      createStatRow(
        "Would take again",
        formatPercent(data.wouldTakeAgainPercent),
        wouldTakeTone(data.wouldTakeAgainPercent),
      ),
      createStatRow(
        "Difficulty",
        formatRating(data.difficulty),
        difficultyTone(data.difficulty),
      ),
    );
    container.appendChild(rows);

    const footer = document.createElement("div");
    footer.className = "ass-rmp__footer";

    if (data.profileUrl) {
      footer.appendChild(createFooterLink("View on RateMyProfessors", data.profileUrl));
    }

    const via = document.createElement("div");
    via.className = "ass-rmp__via";
    const viaLink = document.createElement("a");
    viaLink.href = shareUrl();
    viaLink.target = "_blank";
    viaLink.rel = "noopener noreferrer";
    viaLink.textContent = "via ass.vijit.app";
    via.appendChild(viaLink);
    footer.appendChild(via);

    container.appendChild(footer);
    return true;
  }

  function getOrCreateBlock(anchor, displayName) {
    const next = anchor.nextElementSibling;
    if (next?.classList?.contains("ass-rmp")) {
      return next;
    }

    const block = document.createElement("div");
    block.className = "ass-rmp";
    block.dataset.assRmpFor = displayName;
    anchor.insertAdjacentElement("afterend", block);
    return block;
  }

  function isFresh(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const ts = entry.cachedAtMs || entry._ts;
    if (!ts) {
      return false;
    }
    return Date.now() - ts <= cacheTtlMs();
  }

  function applyStoredCache(stored) {
    const raw = stored?.[CACHE_KEY];
    const fresh = {};
    if (raw && typeof raw === "object") {
      for (const [name, entry] of Object.entries(raw)) {
        if (!isFresh(entry)) {
          continue;
        }
        if (entry.miss) {
          // Legacy misses (no missReason) may be transient errors cached before v3.0.1.
          if (entry.missReason !== "not_found") {
            continue;
          }
        }
        fresh[name] = entry;
      }
    }
    cacheByName = fresh;
    missNames = new Set(
      (Array.isArray(stored?.[MISS_KEY]) ? stored[MISS_KEY] : []).filter(
        (name) => fresh[name]?.missReason === "not_found",
      ),
    );
    cacheLoaded = true;
  }

  function ensureCacheLoaded() {
    if (cacheLoaded) {
      return Promise.resolve();
    }
    if (!cacheLoadPromise) {
      cacheLoadPromise = new Promise((resolve) => {
        chrome.storage.local.get([CACHE_KEY, MISS_KEY], (stored) => {
          applyStoredCache(stored || {});
          resolve();
        });
      });
    }
    return cacheLoadPromise;
  }

  function persistCache() {
    const payload = {};
    for (const [name, entry] of Object.entries(cacheByName)) {
      payload[name] = { ...entry, cachedAtMs: entry.cachedAtMs || Date.now() };
    }
    selfPersisting = true;
    chrome.storage.local.set(
      {
        [CACHE_KEY]: payload,
        [MISS_KEY]: [...missNames],
      },
      () => {
        selfPersisting = false;
      },
    );
  }

  function cachedEntryFor(name) {
    const entry = cacheByName[name];
    if (entry && isFresh(entry)) {
      return entry;
    }
    return null;
  }

  function lookupProfessor(parsed) {
    return new Promise((resolve) => {
      if (!ext()) {
        resolve({ ok: false, reason: "context_invalid" });
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "ASS_LOOKUP_PROFESSOR",
          lastName: parsed.lastName,
          firstInitial: parsed.firstInitial,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, reason: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, reason: "empty_response" });
        },
      );
    });
  }

  function runNextInQueue() {
    while (inFlight < maxConcurrent() && waitQueue.length) {
      const job = waitQueue.shift();
      inFlight += 1;
      job().finally(() => {
        inFlight -= 1;
        runNextInQueue();
      });
    }
  }

  function enqueueLookup(jobFn) {
    return new Promise((resolve) => {
      waitQueue.push(() => jobFn().then(resolve));
      runNextInQueue();
    });
  }

  function shouldCacheMiss(response) {
    const reason = response?.reason;
    return reason === "not_found" || reason === "skipped";
  }

  function storeLookupResult(displayName, response) {
    if (response.ok && response.professor) {
      const entry = {
        ...response.professor,
        cachedAtMs: Date.now(),
      };
      cacheByName[displayName] = entry;
      missNames.delete(displayName);
      persistCache();
      return entry;
    }

    if (!shouldCacheMiss(response)) {
      return { miss: true, transient: true };
    }

    const missEntry = { miss: true, missReason: "not_found", cachedAtMs: Date.now() };
    cacheByName[displayName] = missEntry;
    missNames.add(displayName);
    persistCache();
    return missEntry;
  }

  function fetchProfessorEntry(parsed) {
    const { displayName } = parsed;
    const cached = cachedEntryFor(displayName);
    if (cached) {
      return Promise.resolve(cached);
    }
    if (missNames.has(displayName)) {
      return Promise.resolve({ miss: true });
    }
    if (lookupByName.has(displayName)) {
      return lookupByName.get(displayName);
    }

    const pending = enqueueLookup(() => lookupProfessor(parsed)).then((response) =>
      storeLookupResult(displayName, response),
    );
    lookupByName.set(displayName, pending);
    pending.finally(() => {
      if (lookupByName.get(displayName) === pending) {
        lookupByName.delete(displayName);
      }
    });
    return pending;
  }

  async function getProfessorRating(displayName) {
    const parsed = parseProfessorNameForLookup(displayName);
    if (!parsed) {
      return { miss: true, missReason: "skipped" };
    }
    await ensureCacheLoaded();
    return fetchProfessorEntry(parsed);
  }

  function paintBlocksForProfessor(displayName, entry) {
    const state = entry?.miss ? "miss" : "hit";
    for (const block of document.querySelectorAll(
      `.ass-rmp[data-ass-rmp-for="${CSS.escape(displayName)}"]`,
    )) {
      renderBlock(block, state, entry);
    }
  }

  async function resolveProfessor(parsed, block) {
    const cached = cachedEntryFor(parsed.displayName);
    if (cached) {
      renderBlock(block, cached.miss ? "miss" : "hit", cached);
      return;
    }
    if (missNames.has(parsed.displayName)) {
      renderBlock(block, "miss");
      return;
    }

    if (block.dataset.assRmpRendered !== "loading") {
      renderBlock(block, "loading");
    }

    const entry = await fetchProfessorEntry(parsed);
    renderBlock(block, entry?.miss ? "miss" : "hit", entry);
    paintBlocksForProfessor(parsed.displayName, entry);
  }

  function collectInstructorAnchors() {
    const selector = instructorSelector();
    const savedRoot = document.querySelector(
      config.rmpSavedContainerSelector || "#SavedSchedulesListDisplayContainer",
    );
    const seen = new Set();
    const anchors = [];

    for (const root of rmpRoots()) {
      for (const anchor of root.querySelectorAll(selector)) {
        if (seen.has(anchor)) {
          continue;
        }
        seen.add(anchor);
        anchors.push(anchor);
      }
    }

    if (savedRoot) {
      for (const anchor of savedRoot.querySelectorAll("a")) {
        if (seen.has(anchor)) {
          continue;
        }
        const parsed = parseInstructorLabel(anchor.textContent);
        if (!parsed) {
          continue;
        }
        seen.add(anchor);
        anchors.push(anchor);
      }
    }

    return anchors;
  }

  function processAnchor(anchor) {
    const parsed = parseInstructorLabel(anchor.textContent);
    if (!parsed) {
      return;
    }

    const block = getOrCreateBlock(anchor, parsed.displayName);

    const cached = cachedEntryFor(parsed.displayName);
    if (cached) {
      renderBlock(block, cached.miss ? "miss" : "hit", cached);
      return;
    }
    if (missNames.has(parsed.displayName)) {
      renderBlock(block, "miss");
      return;
    }

    void resolveProfessor(parsed, block);
  }

  function scanInstructors() {
    if (!ASS.state?.settings?.showProfessorRatings) {
      return;
    }
    ensureStyles();
    void ensureCacheLoaded().then(() => {
      for (const anchor of collectInstructorAnchors()) {
        processAnchor(anchor);
      }
    });
  }

  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanInstructors, 280);
  }

  function startObserver() {
    if (observerStarted) {
      return;
    }
    observerStarted = true;
    new MutationObserver(scheduleScan).observe(document.body, {
      childList: true,
      subtree: true,
    });
    void ensureCacheLoaded().then(scheduleScan);
  }

  function syncProfessorRatings() {
    startObserver();
  }

  function removeProfessorRatings() {
    clearTimeout(debounceTimer);
    lookupByName.clear();
    document.querySelectorAll(".ass-rmp").forEach((node) => node.remove());
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || selfPersisting) {
      return;
    }
    if (!changes[CACHE_KEY] && !changes[MISS_KEY]) {
      return;
    }

    cacheLoaded = false;
    cacheLoadPromise = null;
    lookupByName.clear();

    void ensureCacheLoaded().then(() => {
      document.querySelectorAll(".ass-rmp").forEach((block) => {
        delete block.dataset.assRmpRendered;
      });
      if (ASS.state?.settings?.showProfessorRatings) {
        scheduleScan();
      }
    });
  });

  void ensureCacheLoaded();

  Object.assign(api, {
    syncProfessorRatings,
    removeProfessorRatings,
    getProfessorRating,
  });
})();
