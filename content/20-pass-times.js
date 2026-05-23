(() => {
  const ASS = window.ASS;
  const { config, state, api } = ASS;
  const { snipeLog } = api;

  function getVisiblePassTimeSourceText() {
    return (
      document.getElementById("PassTimesContainer")?.innerText ||
      document.querySelector(".passtime-container")?.innerText ||
      document.body?.innerText ||
      ""
    );
  }

  function parsePassTimesFromVisibleText(visibleText) {
    const parsedPassTimes = [];
    const regex = new RegExp(config.passTimeRegex.source, "gi");

    for (const match of visibleText.matchAll(regex)) {
      const passNumber = Number.parseInt(match[1] || "0", 10);
      const parsedDate = parsePacificTimeString(match[2]);
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        continue;
      }

      parsedPassTimes.push({
        passId: `pass-${passNumber}`,
        passNumber,
        dateMs: parsedDate.getTime(),
      });
    }

    parsedPassTimes.sort((a, b) => a.dateMs - b.dateMs);
    return parsedPassTimes;
  }

  function getDomPassTimeDiagnostics() {
    const visibleText = getVisiblePassTimeSourceText();
    const regex = new RegExp(config.passTimeRegex.source, "gi");
    const rawMatches = [...visibleText.matchAll(regex)].map((m) => ({
      full: m[0],
      passNumber: m[1],
      dateStringFromPage: m[2],
    }));
    const passes = parsePassTimesFromVisibleText(visibleText);

    return {
      visibleTextLength: visibleText.length,
      regexMatchCount: rawMatches.length,
      regexSamples: rawMatches.slice(0, 8),
      parsedPasses: passes.map((p) => ({
        passNumber: p.passNumber,
        opensAtMs: p.dateMs,
        opensAtIso: new Date(p.dateMs).toISOString(),
      })),
    };
  }

  function getParsedPassTimes() {
    if (state.simulatedPassTimeMs) {
      return [
        {
          passId: "pass-1",
          passNumber: 1,
          dateMs: state.simulatedPassTimeMs,
        },
      ];
    }

    const visibleText = getVisiblePassTimeSourceText();
    const parsedPassTimes = parsePassTimesFromVisibleText(visibleText);

    if (parsedPassTimes.length > 0) {
      state.passTimeCache = {
        items: parsedPassTimes,
        cachedAtMs: Date.now(),
      };
      return parsedPassTimes;
    }

    const cacheAgeMs = Date.now() - state.passTimeCache.cachedAtMs;
    if (cacheAgeMs <= config.passCacheTtlMs) {
      return state.passTimeCache.items;
    }

    state.passTimeCache = {
      items: [],
      cachedAtMs: 0,
    };
    return [];
  }

  function selectTrackedPass(passTimes) {
    if (passTimes.length === 0) {
      state.selectedPassId = null;
      return null;
    }

    const nowMs = Date.now();
    const passById = new Map(passTimes.map((pass) => [pass.passId, pass]));
    const nextUpcomingPass =
      passTimes.find((pass) => pass.dateMs > nowMs) || null;
    const recentActivePass = getCurrentlyActivePass(passTimes);
    if (!state.selectedPassId) {
      const initialPass = nextUpcomingPass || recentActivePass;
      state.selectedPassId = initialPass?.passId || null;
      return initialPass || null;
    }

    const pinnedPass = passById.get(state.selectedPassId);
    if (
      pinnedPass &&
      nowMs <= pinnedPass.dateMs + config.passActiveWindowMs
    ) {
      return pinnedPass;
    }

    const replacementPass = nextUpcomingPass || recentActivePass;
    state.selectedPassId = replacementPass?.passId || null;
    return replacementPass || null;
  }

  function getCurrentlyActivePass(passTimes) {
    const nowMs = Date.now();

    return (
      passTimes
        .filter(
          (pass) =>
            nowMs >= pass.dateMs &&
            nowMs <= pass.dateMs + config.passActiveWindowMs,
        )
        .sort((a, b) => b.dateMs - a.dateMs)[0] || null
    );
  }

  function initializePassTrackingState(passTimes) {
    const nowMs = Date.now();
    for (const pass of passTimes) {
      if (!state.activationSeenByPassId.has(pass.passId)) {
        state.activationSeenByPassId.set(pass.passId, false);
      }

      if (!state.clickAttemptStateByPassId.has(pass.passId)) {
        state.clickAttemptStateByPassId.set(pass.passId, {
          started: false,
          attempts: 0,
          outcome: "idle",
          message: "",
        });
      }

      if (
        !state.activationSeenByPassId.get(pass.passId) &&
        nowMs >= pass.dateMs
      ) {
        state.activationSeenByPassId.set(pass.passId, true);
        if (!ASS.passActivationAnnounced.has(pass.passId)) {
          ASS.passActivationAnnounced.add(pass.passId);
          snipeLog("[pass_open]", {
            passNumber: pass.passNumber,
            passId: pass.passId,
            opensAtMs: pass.dateMs,
            opensAtIso: new Date(pass.dateMs).toISOString(),
            nowMs,
            ucdTest: !!state.simulatedPassTimeMs,
          });
        }
      }
    }
  }

  function formatDuration(durationMs) {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(
      2,
      "0",
    );
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      "0",
    );
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return days > 0
      ? `${days}d ${hours}:${minutes}:${seconds}`
      : `${hours}:${minutes}:${seconds}`;
  }

  function formatCountdownLabel(targetPass) {
    const nowMs = Date.now();
    const msUntilPass = targetPass.dateMs - nowMs;

    if (msUntilPass > 0) {
      return `Pass ${targetPass.passNumber} in: ${formatDuration(msUntilPass)}`;
    }

    if (nowMs <= targetPass.dateMs + config.passActiveWindowMs) {
      return `Pass ${targetPass.passNumber} currently active`;
    }
    return "No upcoming pass-time";
  }

  function parsePacificTimeString(value) {
    const match = value.match(
      /^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
    );
    if (!match) return null;

    const monthIndexByShortName = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    const monthIndex = monthIndexByShortName[match[1].slice(0, 3)];
    const day = Number(match[2]);
    const year = Number(match[3]);

    let hour24 = Number(match[4]) % 12;
    if (match[6].toUpperCase() === "PM") {
      hour24 += 12;
    }

    const minute = Number(match[5]);

    const daylightSavingStartDay = getNthWeekdayOfMonth(year, 2, 0, 2);
    const daylightSavingEndDay = getNthWeekdayOfMonth(year, 10, 0, 1);

    const utcProbeTime = new Date(
      Date.UTC(year, monthIndex, day, hour24, minute),
    );
    const dstStartBoundary = new Date(
      Date.UTC(year, 2, daylightSavingStartDay, 10),
    );
    const dstEndBoundary = new Date(
      Date.UTC(year, 10, daylightSavingEndDay, 9),
    );

    const utcOffset =
      utcProbeTime >= dstStartBoundary && utcProbeTime < dstEndBoundary
        ? "-0700"
        : "-0800";

    const paddedMonth = String(monthIndex + 1).padStart(2, "0");
    const paddedDay = String(day).padStart(2, "0");
    const paddedHour = String(hour24).padStart(2, "0");
    const paddedMinute = String(minute).padStart(2, "0");

    return new Date(
      `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinute}:00.000${utcOffset}`,
    );
  }

  function getNthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
    const firstDayWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    return 1 + ((weekday - firstDayWeekday + 7) % 7) + 7 * (occurrence - 1);
  }

  Object.assign(api, {
    getVisiblePassTimeSourceText,
    parsePassTimesFromVisibleText,
    getDomPassTimeDiagnostics,
    getParsedPassTimes,
    selectTrackedPass,
    getCurrentlyActivePass,
    initializePassTrackingState,
    formatDuration,
    formatCountdownLabel,
    parsePacificTimeString,
  });
})();
