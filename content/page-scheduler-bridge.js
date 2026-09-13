/**
 * Runs in Schedule Builder's MAIN world. It exposes only the page's existing
 * course-search, live-seat, and save-course operations over window messages.
 */
(function () {
  if (window.top !== window || window.__ASS_SCHEDULER_PAGE_BRIDGE__) {
    return;
  }
  window.__ASS_SCHEDULER_PAGE_BRIDGE__ = true;

  const CHANNEL = "ASS_ADVANCED_PLANNER_BRIDGE_V1";
  const rememberedByCrn = new Map();

  function courseSaveKey(raw) {
    const printable = String(raw?.course?.printCRN || "").trim();
    if (printable && printable !== "@") {
      return printable;
    }
    return String(raw?.course?.hidCRN || raw?.course?.crn || printable).trim();
  }

  function currentTermCode() {
    const globalValue = String(window.termCode || "").trim();
    if (globalValue) {
      return globalValue;
    }
    const search = String(window.location?.search || "");
    const match = search.match(/[?&]termCode=([^&]+)/i);
    if (match) {
      return decodeURIComponent(match[1]).trim();
    }
    return String(
      window.document?.querySelector("input[name='termCode']")?.value || "",
    ).trim();
  }

  function courseSuggestion(raw) {
    const subjectCode = String(raw?.course?.subjectCode || "").trim().toUpperCase();
    const courseNum = String(raw?.course?.courseNum || "").trim().toUpperCase();
    if (!subjectCode || !courseNum) {
      return null;
    }
    return {
      courseKey: `${subjectCode} ${courseNum}`,
      title: String(raw?.course?.title || "").trim(),
    };
  }

  /** Schedule Builder rejects with strings and with objects carrying `error`. */
  function describeError(error) {
    if (typeof error === "string") {
      return error;
    }
    return String(error?.message || error?.error || "Schedule Builder returned an error.");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForPageApi(name, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = window[name];
      if (value) {
        return value;
      }
      await wait(100);
    }
    throw new Error(`Schedule Builder ${name} API did not become ready.`);
  }

  /** JSON-safe clone of Schedule Builder objects (methods / cycles dropped). */
  function plainValue(value, depth = 0) {
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (depth > 8) {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((item) => plainValue(item, depth + 1));
    }
    if (typeof value === "object") {
      const out = {};
      for (const [key, nested] of Object.entries(value)) {
        if (typeof nested === "function") {
          continue;
        }
        out[key] = plainValue(nested, depth + 1);
      }
      return out;
    }
    return null;
  }

  /** Copies only the fields the planner ranks with; page objects are not cloneable. */
  function plainCourseResult(raw, seats, existingConflict) {
    return {
      course: {
        subjectCode: raw?.course?.subjectCode,
        courseNum: raw?.course?.courseNum,
        shortDesc: raw?.course?.shortDesc,
        printCRN: raw?.course?.printCRN,
        hidCRN: raw?.course?.hidCRN,
        crn: raw?.course?.crn,
        title: raw?.course?.title,
        unitsLow: raw?.course?.unitsLow,
        seatsAvail: raw?.course?.seatsAvail,
        waitCount: raw?.course?.waitCount,
      },
      instructor: (Array.isArray(raw?.instructor) ? raw.instructor : []).map((item) => ({
        instructorName: item?.instructorName,
      })),
      meeting: (Array.isArray(raw?.meeting) ? raw.meeting : []).map((item) => ({
        description: item?.description,
        type: item?.type,
        meetCode: item?.meetCode,
        daysString: item?.daysString,
        startTime: item?.startTime,
        endTime: item?.endTime,
        building: item?.building,
        room: item?.room,
        sunday: item?.sunday,
        monday: item?.monday,
        tuesday: item?.tuesday,
        wednesday: item?.wednesday,
        thursday: item?.thursday,
        friday: item?.friday,
        saturday: item?.saturday,
      })),
      finalExam: raw?.finalExam ? { examDate: raw.finalExam.examDate } : null,
      icmsData: raw?.icmsData
        ? {
            newDescription: raw.icmsData.newDescription,
            description: raw.icmsData.description,
            geCredit: raw.icmsData.geCredit,
            geCourses: raw.icmsData.geCourses,
            formerGeCredit: raw.icmsData.formerGeCredit,
            oldGeCredit: raw.icmsData.oldGeCredit,
            catalogUrl: raw.icmsData.catalogUrl,
            catalogURL: raw.icmsData.catalogURL,
          }
        : null,
      seats: seats
        ? { seatsAvail: seats.seatsAvail, waitCount: seats.waitCount }
        : null,
      existingScheduleConflict: existingConflict,
    };
  }

  function getCourseDetails(payload) {
    const crn = String(payload?.crn || "").trim();
    const raw = rememberedByCrn.get(crn);
    if (!raw) {
      throw new Error("Course data is no longer available; search again.");
    }
    return { details: plainValue(raw) };
  }

  async function mapWithLimit(items, limit, worker, onProgress) {
    const output = new Array(items.length);
    let nextIndex = 0;
    let completed = 0;
    async function run() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        output[index] = await worker(items[index], index);
        completed += 1;
        onProgress?.(completed, items.length);
      }
    }
    const workers = Array.from(
      { length: Math.min(Math.max(1, limit), Math.max(1, items.length)) },
      run,
    );
    await Promise.all(workers);
    return output;
  }

  function post(id, kind, payload) {
    window.postMessage(
      { channel: CHANNEL, direction: "response", id, kind, payload },
      window.location.origin,
    );
  }

  async function ensureUserReady() {
    const userApi = await waitForPageApi("user", 15000);
    if (userApi.pidm) {
      return;
    }
    if (typeof userApi.init === "function") {
      userApi.init();
    }
    const startedAt = Date.now();
    while (!userApi.pidm && Date.now() - startedAt < 15000) {
      await wait(100);
    }
    if (!userApi.pidm) {
      throw new Error("Schedule Builder user session is not ready. Please refresh or sign in again.");
    }
  }

  async function loadCurrentScheduleConflicts() {
    const scheduleApi = await waitForPageApi("schedule", 15000);
    if (
      typeof scheduleApi.timeConflict?.Load !== "function" ||
      typeof scheduleApi.timeConflict?.checkCourse !== "function"
    ) {
      throw new Error("Schedule Builder's current-schedule conflict API is unavailable.");
    }
    scheduleApi.timeConflict.Load();
    return scheduleApi.timeConflict;
  }

  function checkRawCourseConflict(conflictApi, raw) {
    const conflict = conflictApi.checkCourse(
      Array.isArray(raw?.meeting) ? raw.meeting : [],
    );
    if (conflict?.bool !== true) {
      return false;
    }

    const courseKey = rawCourseKey(raw);
    if (!matchingCourseCards(courseKey).length) {
      return true;
    }

    const namedConflicts = [
      ...String(conflict.text || "").matchAll(/\b([A-Z]{2,4})\s+(\d{3}[A-Z]?)\b/g),
    ].map((match) => `${match[1]} ${match[2]}`.toUpperCase());
    return namedConflicts.some((key) => key !== courseKey);
  }

  async function searchCourses(id, payload) {
    const searchApi = await waitForPageApi("search", 15000);
    await ensureUserReady();
    const conflictApi = await loadCurrentScheduleConflicts();
    if (typeof searchApi.search !== "function") {
      throw new Error("Schedule Builder search function is unavailable.");
    }
    const rawResults = await searchApi.search(String(payload?.query || ""));
    const results = Array.isArray(rawResults)
      ? rawResults
      : Object.values(rawResults || {});
    if (payload?.resetMemory) {
      rememberedByCrn.clear();
    }
    for (const raw of results) {
      const saveKey = courseSaveKey(raw);
      if (saveKey) {
        rememberedByCrn.set(saveKey, raw);
      }
    }

    const withSeats = await mapWithLimit(
      results,
      5,
      async (raw) => {
        const crn = String(raw?.course?.printCRN || raw?.course?.crn || "").trim();
        const existingConflict = checkRawCourseConflict(conflictApi, raw);
        if (!crn || crn === "@" || typeof searchApi.fetchSeatAvailability !== "function") {
          return plainCourseResult(raw, null, existingConflict);
        }
        try {
          const seats = await searchApi.fetchSeatAvailability(crn, currentTermCode());
          return plainCourseResult(raw, seats, existingConflict);
        } catch {
          return plainCourseResult(raw, null, existingConflict);
        }
      },
      (completed, total) => post(id, "progress", { stage: "seats", completed, total }),
    );
    return { results: withSeats };
  }

  async function suggestCourses(payload) {
    const query = String(payload?.query || "").trim();
    if (query.length < 2) {
      return { suggestions: [] };
    }
    const searchApi = await waitForPageApi("search", 15000);
    await ensureUserReady();
    if (typeof searchApi.search !== "function") {
      throw new Error("Schedule Builder search function is unavailable.");
    }
    const rawResults = await searchApi.search(query);
    const results = Array.isArray(rawResults)
      ? rawResults
      : Object.values(rawResults || {});
    const byCourse = new Map();
    for (const raw of results) {
      const suggestion = courseSuggestion(raw);
      if (suggestion && !byCourse.has(suggestion.courseKey)) {
        byCourse.set(suggestion.courseKey, suggestion);
      }
      if (byCourse.size >= 15) {
        break;
      }
    }
    return { suggestions: [...byCourse.values()] };
  }

  async function checkExistingScheduleConflicts(payload) {
    const conflictApi = await loadCurrentScheduleConflicts();
    const results = [];
    for (const requestedKey of payload?.courseKeys || []) {
      const courseKey = String(requestedKey || "").trim();
      const raw = rememberedByCrn.get(courseKey);
      if (!raw) {
        results.push({
          courseKey,
          ok: false,
          error: "Course data is no longer available; search again.",
        });
        continue;
      }
      results.push({ courseKey, ok: true, conflict: checkRawCourseConflict(conflictApi, raw) });
    }
    return { results };
  }

  function rawCourseKey(raw) {
    const subject = String(raw?.course?.subjectCode || "").trim().toUpperCase();
    const number = String(raw?.course?.courseNum || "").trim().toUpperCase();
    return subject && number ? `${subject} ${number}` : "";
  }

  function cardStatus(card) {
    const text = String(card?.textContent || "");
    const statusText = [...(card?.querySelectorAll?.(".statusIndicator, .statusIndicator2") || [])]
      .map((node) => `${node.className || ""} ${node.textContent || ""}`)
      .join(" ");
    if (
      /\bwaitlist(?:ed)?\b/i.test(statusText) ||
      /Registration Status:\s*Waitlist(?:ed)?/i.test(text)
    ) {
      return "waitlisted";
    }
    if (
      /\bnot\s+registered\b|\bnonregistered\b|\bnotregistered\b/i.test(statusText) ||
      /Registration Status:\s*Not Registered/i.test(text)
    ) {
      return "saved";
    }
    return (
      /\bregistered\b/i.test(statusText) ||
      /Registration Status:\s*Registered/i.test(text)
    ) ? "registered" : "saved";
  }

  function matchingCourseCards(courseKey) {
    const document = window.document;
    if (!document?.querySelectorAll || !courseKey) {
      return [];
    }
    const [subject, number] = courseKey.split(" ");
    const pattern = new RegExp(`\\b${subject}\\s+${number}(?:\\s|$)`, "i");
    return [...document.querySelectorAll(
      "#SavedSchedulesListDisplayContainer article.CourseItem",
    )].filter((card) => pattern.test(String(card.textContent || "")));
  }

  function cardCrn(card) {
    return String(card?.textContent || "").match(/\bCRN\s*:?\s*([A-Z0-9@-]+)/i)?.[1] || "";
  }

  function removalControl(card) {
    const controls = card?.querySelectorAll?.("button, a, input") || [];
    return [...controls].find((control) => {
      const label = [
        control.textContent,
        control.value,
        control.title,
        control.getAttribute?.("aria-label"),
        control.getAttribute?.("data-original-title"),
      ].filter(Boolean).join(" ");
      return /\b(remove|delete)\b/i.test(label) && !/\b(drop|registered|waitlist)\b/i.test(label);
    }) || null;
  }

  async function removeSavedCard(card, courseKey, crn) {
    const control = removalControl(card);
    if (!control) {
      throw new Error(`Could not replace ${courseKey}; remove its saved section first.`);
    }
    control.click();

    const startedAt = Date.now();
    let confirmed = false;
    while (window.document?.contains?.(card) && Date.now() - startedAt < 4000) {
      if (!confirmed) {
        const dialogs = window.document?.querySelectorAll?.(
          ".modal.in, .modal.show, [role='dialog']",
        ) || [];
        const dialog = [...dialogs].find((node) => {
          const text = String(node.textContent || "");
          return /\b(remove|delete)\b/i.test(text) &&
            (text.includes(courseKey) || !crn || text.includes(crn));
        });
        const confirm = dialog && [...dialog.querySelectorAll("button, a, input")].find((node) => {
          const label = String(node.textContent || node.value || "").trim();
          return /^(remove|delete|yes|confirm)(?:\s+course)?$/i.test(label);
        });
        if (confirm) {
          confirm.click();
          confirmed = true;
        }
      }
      await wait(50);
    }
    if (window.document?.contains?.(card)) {
      throw new Error(`Could not replace ${courseKey}; remove CRN ${crn || "currently saved"} first.`);
    }
  }

  async function saveCourses(payload) {
    const scheduleApi = await waitForPageApi("schedule", 15000);
    if (typeof scheduleApi.addCourse !== "function") {
      throw new Error("Schedule Builder save-course function is unavailable.");
    }
    const results = [];
    for (const requestedCrn of payload?.crns || []) {
      const crn = String(requestedCrn || "").trim();
      const raw = rememberedByCrn.get(crn);
      if (!raw) {
        results.push({ crn, ok: false, error: "Course data is no longer available; search again." });
        continue;
      }
      const courseKey = rawCourseKey(raw);
      try {
        const sameCourse = matchingCourseCards(courseKey);
        const exact = sameCourse.find((card) => cardCrn(card) === crn);
        if (exact) {
          results.push({ crn, courseKey, ok: true, alreadySaved: true });
          continue;
        }

        const active = sameCourse.find((card) =>
          ["registered", "waitlisted"].includes(cardStatus(card)),
        );
        if (active) {
          const status = cardStatus(active);
          results.push({
            crn,
            courseKey,
            ok: false,
            error: `${courseKey} is already ${status}; its section was not replaced.`,
          });
          continue;
        }

        if (sameCourse.length) {
          let addedFirst = false;
          try {
            // Prefer adding first so a failed add cannot erase the old saved section.
            await scheduleApi.addCourse(raw);
            addedFirst = true;
          } catch {
            // Schedule Builder may reject duplicate course codes.
          }
          if (addedFirst) {
            for (const card of sameCourse) {
              if (window.document?.contains?.(card)) {
                await removeSavedCard(card, courseKey, cardCrn(card));
              }
            }
          } else {
            // Remove only the old unregistered section, then retry the add.
            for (const card of sameCourse) {
              await removeSavedCard(card, courseKey, cardCrn(card));
            }
            await scheduleApi.addCourse(raw);
          }
          results.push({ crn, courseKey, ok: true, replaced: true });
          continue;
        }

        await scheduleApi.addCourse(raw);
        results.push({ crn, courseKey, ok: true, replaced: false });
      } catch (error) {
        // Schedule Builder rejects an already-saved course with "no-error".
        const reason = describeError(error);
        results.push({ crn, courseKey, ok: reason === "no-error", error: reason });
      }
    }
    return { results };
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      message?.channel !== CHANNEL ||
      message?.direction !== "request" ||
      !message.id
    ) {
      return;
    }

    void (async () => {
      try {
        let result;
        if (message.action === "search_courses") {
          result = await searchCourses(message.id, message.payload);
        } else if (message.action === "suggest_courses") {
          result = await suggestCourses(message.payload);
        } else if (message.action === "check_existing_conflicts") {
          result = await checkExistingScheduleConflicts(message.payload);
        } else if (message.action === "save_courses") {
          result = await saveCourses(message.payload);
        } else if (message.action === "get_course_details") {
          result = getCourseDetails(message.payload);
        } else {
          throw new Error(`Unsupported scheduler bridge action: ${message.action}`);
        }
        post(message.id, "result", { ok: true, ...result });
      } catch (error) {
        post(message.id, "result", { ok: false, error: describeError(error) });
      }
    })();
  });
})();
