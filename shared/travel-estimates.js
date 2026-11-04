/** Offline distance model. Speeds and buffers are assumptions, not measured routes. */
(function (root, factory) {
  const data = typeof module !== "undefined" && module.exports
    ? require("./campus-buildings.js") : root.ASS_CAMPUS_BUILDINGS;
  const api = factory(data || []);
  root.ASS_TRAVEL_ESTIMATES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, function (buildings) {
  const normalize = (value) => String(value || "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const primary = new Map(buildings.map((building) => [normalize(building.name), building]));
  const index = new Map();
  function add(alias, building) {
    const key = normalize(alias);
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(building);
  }
  for (const building of buildings) {
    for (const alias of building.aliases) {
      add(alias, building);
      if (/ Hall$/i.test(alias)) add(alias.replace(/ Hall$/i, ""), building);
    }
  }
  const genericWords = new Set(["hall", "building", "bldg", "lecture", "auditorium", "room", "the", "and"]);
  function keywords(value) {
    return [...new Set(normalize(value).split(" ")
      .filter((word) => word && word.length > 1 && !genericWords.has(word)))].sort();
  }
  const keywordIndex = new Map();
  const fuzzyAliases = [];
  for (const building of buildings) {
    for (const alias of [building.name, ...building.aliases]) {
      const words = keywords(alias);
      if (!words.length) continue;
      const key = words.join(" ");
      if (!keywordIndex.has(key)) keywordIndex.set(key, new Set());
      keywordIndex.get(key).add(building);
      fuzzyAliases.push({ words, building });
    }
  }
  // One inserted, deleted, or substituted character in a distinctive word.
  function nearbyWord(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1 || /\d/.test(a + b)) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  const resolvedCache = new Map();
  function unique(candidates) {
    return candidates?.size === 1 ? [...candidates][0] : null;
  }
  function matchLocation(key) {
    // Try complete names before removing room numbers: numbered buildings remain distinct.
    const withoutRoom = key.replace(/\s+(?:room\s+)?[a-z]?\d+[a-z]?$/, "");
    const exact = primary.get(key) || primary.get(withoutRoom);
    if (exact) return exact;
    const candidates = index.get(key) || index.get(withoutRoom);
    if (candidates) return unique(candidates);
    const words = keywords(withoutRoom);
    if (!words.length) return null;
    const keywordMatches = keywordIndex.get(words.join(" "));
    if (keywordMatches) return unique(keywordMatches);
    const fuzzyMatches = new Set();
    for (const alias of fuzzyAliases) {
      if (alias.words.length !== words.length) continue;
      const remaining = [...alias.words];
      let differences = 0;
      const matches = words.every((word) => {
        let index = remaining.indexOf(word);
        if (index < 0) {
          index = remaining.findIndex((candidate) => nearbyWord(word, candidate));
          differences++;
        }
        if (index < 0 || differences > 1) return false;
        remaining.splice(index, 1);
        return true;
      });
      if (matches) fuzzyMatches.add(alias.building);
    }
    return unique(fuzzyMatches);
  }
  function resolve(value) {
    const key = normalize(value);
    if (!key || /^(tba|tbd|online|remote|arranged|web)\b/.test(key)) return null;
    if (resolvedCache.has(key)) return resolvedCache.get(key);
    const result = matchLocation(key);
    if (resolvedCache.size >= 500) resolvedCache.clear();
    resolvedCache.set(key, result);
    return result;
  }
  function estimate(from, to) {
    const origin = resolve(from.building || from.location);
    const destination = resolve(to.building || to.location);
    if (!origin || !destination) return null;
    if (origin === destination) return { walking: 2, cycling: 2, sameBuilding: true, origin, destination };
    const rad = (n) => n * Math.PI / 180;
    const dLat = rad(destination.lat - origin.lat);
    const dLon = rad(destination.lon - origin.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(origin.lat)) * Math.cos(rad(destination.lat)) * Math.sin(dLon / 2) ** 2;
    const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    const distance = meters * 1.3; // Assumed detour allowance; no path graph is consulted.
    return { walking: Math.ceil(distance / (4800 / 60) + 2),
      cycling: Math.ceil(distance / (12000 / 60) + 4), sameBuilding: false, origin, destination };
  }
  function assessTransfer(from, to, gap) {
    const times = estimate(from, to);
    if (!times) return null;
    const walkSpare = gap - times.walking;
    const bikeSpare = gap - times.cycling;
    const isTight = walkSpare < 3 || bikeSpare < 3;
    let status = "doable";
    let tone = "good";
    if (Math.max(walkSpare, bikeSpare) < 0) {
      status = "not enough time"; tone = "short";
    } else if (times.sameBuilding && isTight) {
      status = "tight room change"; tone = "tight";
    } else if (walkSpare < 0) {
      status = "bike recommended"; tone = "tight";
    } else if (bikeSpare < 0) {
      status = "walk recommended"; tone = "tight";
    } else if (walkSpare < 3) {
      status = "tight on foot"; tone = "tight";
    } else if (bikeSpare < 3) {
      status = "tight by bike"; tone = "tight";
    }
    return { ...times, isTight, status, tone };
  }
  return { resolve, estimate, assessTransfer };
});
