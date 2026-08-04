/**
 * Runs in Schedule Builder's MAIN world. It exposes only the page's existing
 * course-search, live-seat, and save-course operations over window messages.
 */
(function () {
  if (window.top !== window || window.__ASS_SCHEDULER_PAGE_BRIDGE__) {
    return;
  }
  window.__ASS_SCHEDULER_PAGE_BRIDGE__ = true;

  const CHANNEL = "ASS_AUTO_SCHEDULER_BRIDGE_V1";
  const rememberedByCrn = new Map();

  function courseSaveKey(raw) {
    const printable = String(raw?.course?.printCRN || "").trim();
    if (printable && printable !== "@") {
      return printable;
    }
    return String(raw?.course?.hidCRN || raw?.course?.crn || printable).trim();
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

  function plainCourseResult(raw, seats, seatError) {
    return {
      course: {
        subjectCode: raw?.course?.subjectCode,
        courseNum: raw?.course?.courseNum,
        shortDesc: raw?.course?.shortDesc,
        seqNum: raw?.course?.seqNum,
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
        firstName: item?.firstName,
        lastName: item?.lastName,
        instructorEmail: item?.instructorEmail,
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
      finalExam: { examDate: raw?.finalExam?.examDate },
      seats: seats
        ? { seatsAvail: seats.seatsAvail, waitCount: seats.waitCount }
        : null,
      seatError: seatError || null,
    };
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

  async function searchCourses(id, payload) {
    const searchApi = await waitForPageApi("search", 15000);
    await ensureUserReady();
    if (typeof searchApi.search !== "function") {
      throw new Error("Schedule Builder search function is unavailable.");
    }
    const rawResults = await searchApi.search(String(payload?.query || ""));
    const results = Array.isArray(rawResults)
      ? rawResults
      : Object.values(rawResults || {});
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
        if (!crn || crn === "@" || typeof searchApi.fetchSeatAvailability !== "function") {
          return plainCourseResult(raw, null, crn === "@" ? "Consent of instructor required" : null);
        }
        try {
          const seats = await searchApi.fetchSeatAvailability(crn, window.termCode);
          return plainCourseResult(raw, seats, null);
        } catch (error) {
          return plainCourseResult(raw, null, error?.message || String(error));
        }
      },
      (completed, total) => post(id, "progress", { stage: "seats", completed, total }),
    );
    return { results: withSeats };
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
      try {
        await scheduleApi.addCourse(raw);
        results.push({ crn, ok: true });
      } catch (error) {
        const reason = error?.error || error?.message || String(error);
        results.push({
          crn,
          ok: reason === "no-error",
          alreadySaved: reason === "no-error",
          error: reason === "no-error" ? null : reason,
        });
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
        if (message.action === "ping") {
          result = { ready: !!window.search };
        } else if (message.action === "search_courses") {
          result = await searchCourses(message.id, message.payload);
        } else if (message.action === "save_courses") {
          result = await saveCourses(message.payload);
        } else {
          throw new Error(`Unsupported scheduler bridge action: ${message.action}`);
        }
        post(message.id, "result", { ok: true, ...result });
      } catch (error) {
        post(message.id, "result", {
          ok: false,
          error: error?.message || String(error),
        });
      }
    })();
  });
})();
