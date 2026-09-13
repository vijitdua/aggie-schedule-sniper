(() => {
  if (window.self !== window.top) {
    return;
  }

  const ASS = window.ASS;
  const { api } = ASS;
  const core = window.ASS_SCHEDULER_CORE;

  const CHANNEL = "ASS_ADVANCED_PLANNER_BRIDGE_V1";
  const COURSES_KEY = "assAdvancedPlannerCourses";
  const PREFERENCES_KEY = "assAdvancedPlannerPreferences";
  const REQUEST_TIMEOUT_MS = 180000;
  const SUGGESTION_DEBOUNCE_MS = 300;

  // Short banners for when every option had to compromise.
  const LIMIT_BANNERS = {
    overlap: "Given the courses you chose, there is no combination without conflicts.",
    closed: "Given the courses you chose, some have no open seats left.",
    existingConflict: "Every option clashes with a course already in your schedule.",
    waitlist: "Every option needs at least one waitlisted section.",
  };
  const DAY_KEYS = ["M", "T", "W", "R", "F"];
  const DAY_LABELS = { M: "M", T: "T", W: "W", R: "R", F: "F" };
  const GRID_START = 8 * 60;
  const GRID_END = 20 * 60;

  const pendingRequests = new Map();
  const suggestionCache = new Map();
  let requestCounter = 0;

  let root = null;
  let refs = null;
  let balanceControl = null;
  let launcher = null;

  let selectedCourses = [];
  let preferences = core.normalizeSchedulerPreferences();
  let ratingWeight = 0.5;
  let includeWaitlist = false;

  let suggestions = [];
  let activeSuggestionIndex = -1;
  let suggestionTimer = 0;
  let suggestionToken = 0;
  let selectionFeedbackTimer = 0;

  let groups = [];
  let loadedCourseKey = "";
  let planOptions = [];
  let pinned = new Map();
  let searchTruncated = false;
  let busy = false;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function describeError(error) {
    const message = typeof error === "string" ? error : error?.message || error?.error;
    return normalizeText(message) || "Something went wrong. Please try again.";
  }

  function courseSetKey() {
    return selectedCourses.map((course) => course.courseKey).join("|");
  }

  // --- Page bridge ------------------------------------------------------

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      message?.channel !== CHANNEL ||
      message?.direction !== "response" ||
      !pendingRequests.has(message.id)
    ) {
      return;
    }
    const pending = pendingRequests.get(message.id);
    if (message.kind === "progress") {
      pending.onProgress?.(message.payload);
      return;
    }
    clearTimeout(pending.timer);
    pendingRequests.delete(message.id);
    pending.resolve(message.payload || { ok: false, error: "Empty page response" });
  });

  function pageRequest(action, payload, onProgress) {
    return new Promise((resolve) => {
      requestCounter += 1;
      const id = `${Date.now()}-${requestCounter}`;
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        resolve({ ok: false, error: "Schedule Builder took too long to respond." });
      }, REQUEST_TIMEOUT_MS);
      pendingRequests.set(id, { resolve, timer, onProgress });
      window.postMessage(
        { channel: CHANNEL, direction: "request", id, action, payload },
        window.location.origin,
      );
    });
  }

  // --- Shared chrome ----------------------------------------------------

  function setStatus(message, tone) {
    refs.status.textContent = message || "";
    refs.status.className = message
      ? `ass-planner__status ass-planner__status--${tone || "info"}`
      : "ass-planner__status";
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    for (const button of root.querySelectorAll(".ass-planner__btn")) {
      button.disabled = nextBusy || button.dataset.assDisabled === "true";
    }
    refs.continue.disabled = nextBusy || selectedCourses.length === 0;
  }

  function showStep(name) {
    for (const step of root.querySelectorAll("[data-ass-step]")) {
      step.hidden = step.dataset.assStep !== name;
    }
    setStatus("");
  }

  /** A 0..PREFERENCE_STOPS-1 range input drawn over a dotted rail. */
  function createSlider(label, value, onInput) {
    const wrap = document.createElement("div");
    wrap.className = "ass-planner__slider-wrap";
    const rail = document.createElement("div");
    rail.className = "ass-planner__slider-rail";
    for (let stop = 0; stop < core.PREFERENCE_STOPS; stop += 1) {
      rail.appendChild(document.createElement("span"));
    }
    const input = document.createElement("input");
    input.type = "range";
    input.className = "ass-planner__slider";
    input.min = "0";
    input.max = String(core.PREFERENCE_STOPS - 1);
    input.step = "1";
    input.value = String(value);
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => onInput(Number(input.value)));
    wrap.append(rail, input);
    return wrap;
  }

  function appendSliderRow(parent, label, value, onInput) {
    const row = document.createElement("div");
    row.className = "ass-planner__slider-row";
    const name = document.createElement("span");
    name.textContent = label;
    row.append(name, createSlider(label, value, onInput));
    parent.appendChild(row);
  }

  // --- Step 1: courses --------------------------------------------------

  function renderCourses() {
    refs.chips.replaceChildren();
    for (const course of selectedCourses) {
      const chip = document.createElement("span");
      chip.className = "ass-planner__chip";
      const code = document.createElement("span");
      code.textContent = course.courseKey;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ass-planner__chip-remove";
      remove.dataset.assRemoveCourse = course.courseKey;
      remove.setAttribute("aria-label", `Remove ${course.courseKey}`);
      remove.textContent = "×";
      chip.append(code, remove);
      refs.chips.appendChild(chip);
    }
    refs.continue.disabled = busy || selectedCourses.length === 0;
  }

  function closeSuggestions() {
    suggestions = [];
    activeSuggestionIndex = -1;
    refs.suggestions.hidden = true;
    refs.suggestions.replaceChildren();
  }

  function showSuggestionMessage(text) {
    const note = document.createElement("div");
    note.className = "ass-planner__suggestion-note";
    note.textContent = text;
    refs.suggestions.replaceChildren(note);
    refs.suggestions.hidden = false;
  }

  function renderSuggestions() {
    refs.suggestions.replaceChildren();
    suggestions.forEach((course, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `ass-planner__suggestion${index === activeSuggestionIndex ? " is-active" : ""}`;
      option.dataset.assSuggestionIndex = String(index);
      const code = document.createElement("span");
      code.className = "ass-planner__suggestion-code";
      code.textContent = course.courseKey;
      const title = document.createElement("span");
      title.className = "ass-planner__suggestion-title";
      title.textContent = course.title;
      option.append(code, title);
      refs.suggestions.appendChild(option);
    });
    refs.suggestions.hidden = false;
  }

  async function loadSuggestions(query) {
    const trimmed = normalizeText(query);
    if (trimmed.length < 2) {
      closeSuggestions();
      return;
    }
    const cacheKey = trimmed.toUpperCase();
    const token = ++suggestionToken;
    showSuggestionMessage("Searching…");

    let matches = suggestionCache.get(cacheKey);
    if (!matches) {
      const response = await pageRequest("suggest_courses", { query: trimmed });
      if (token !== suggestionToken) {
        return;
      }
      if (!response.ok) {
        showSuggestionMessage("No matching course.");
        return;
      }
      matches = (response.suggestions || [])
        .map((course) => ({
          courseKey: core.parseCourseCodes(course.courseKey)?.[0] || null,
          title: normalizeText(course.title),
        }))
        .filter((course) => course.courseKey);
      suggestionCache.set(cacheKey, matches);
    }
    if (token !== suggestionToken) {
      return;
    }

    const alreadyAdded = new Set(selectedCourses.map((course) => course.courseKey));
    suggestions = matches.filter((course) => !alreadyAdded.has(course.courseKey));
    activeSuggestionIndex = suggestions.length ? 0 : -1;
    if (!suggestions.length) {
      showSuggestionMessage(matches.length ? "Already added." : "No matching course.");
      return;
    }
    renderSuggestions();
  }

  function addCourse(course) {
    if (!course || selectedCourses.some((item) => item.courseKey === course.courseKey)) {
      return;
    }
    selectedCourses.push(course);
    chrome.storage.local.set({ [COURSES_KEY]: selectedCourses });
    refs.courseInput.value = "";
    closeSuggestions();
    renderCourses();
    refs.courseInput.focus();
  }

  function removeCourse(courseKey) {
    selectedCourses = selectedCourses.filter((course) => course.courseKey !== courseKey);
    pinned.delete(courseKey);
    loadedCourseKey = "";
    chrome.storage.local.set({ [COURSES_KEY]: selectedCourses });
    renderCourses();
  }

  // --- Steps 2-4: preferences -------------------------------------------

  function renderTimeStep() {
    refs.timeBody.replaceChildren();
    for (const block of core.TIME_BLOCKS) {
      appendSliderRow(
        refs.timeBody,
        block.rangeLabel,
        preferences.timeBlocks[block.key],
        (level) => {
          preferences.timeBlocks[block.key] = level;
        },
      );
    }
  }

  function renderDayStep() {
    refs.dayBody.replaceChildren();
    for (const option of core.WEEKDAY_OPTIONS) {
      appendSliderRow(refs.dayBody, option.label, preferences.days[option.key], (level) => {
        preferences.days[option.key] = level;
      });
    }
  }

  /**
   * One control, moved between the balance step and the results screen, so the
   * ranking can be retuned without walking the wizard again.
   */
  function createBalanceControl() {
    const node = document.createElement("div");
    node.className = "ass-planner__balance";

    const scale = document.createElement("div");
    scale.className = "ass-planner__balance-scale";
    scale.append(
      Object.assign(document.createElement("span"), { textContent: "Class times" }),
      Object.assign(document.createElement("span"), { textContent: "Professor rating" }),
    );

    const slider = createSlider(
      "Class times versus professor rating",
      Math.round(ratingWeight * (core.PREFERENCE_STOPS - 1)),
      (level) => {
        ratingWeight = level / (core.PREFERENCE_STOPS - 1);
      },
    );

    const waitlist = document.createElement("label");
    waitlist.className = "ass-planner__check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = includeWaitlist;
    checkbox.addEventListener("change", () => {
      includeWaitlist = checkbox.checked;
    });
    waitlist.append(checkbox, document.createTextNode("Waitlisted sections are fine"));

    node.append(scale, slider, waitlist);
    return node;
  }

  // --- Results ----------------------------------------------------------

  function badge(label, tone) {
    const node = document.createElement("span");
    node.className = `ass-planner__badge ass-planner__badge--${tone}`;
    node.textContent = label;
    return node;
  }

  function formatClock(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? "p" : "a";
    return `${hour24 % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`;
  }

  function renderBanner() {
    const option = planOptions[0];
    const kind = Object.keys(LIMIT_BANNERS).find((key) => option?.limits.includes(key));
    refs.banner.hidden = !kind;
    refs.banner.textContent = kind ? LIMIT_BANNERS[kind] : "";
  }

  function syncToolbar() {
    const complete = groups.length > 0 && pinned.size === groups.length;
    refs.save.dataset.assDisabled = String(!complete);
    refs.save.disabled = busy || !complete;
    refs.save.textContent = complete ? "Save" : "Select all courses";
  }

  function courseColorIndex(courseKey) {
    const index = selectedCourses.findIndex((course) => course.courseKey === courseKey);
    return (index < 0 ? 0 : index) % 6;
  }

  function isLockedSection(section) {
    return pinned.get(section.courseKey) === core.sectionKey(section);
  }

  function orderedSections(sections) {
    return [...sections].sort((a, b) => {
      const lockedFirst = Number(isLockedSection(b)) - Number(isLockedSection(a));
      return lockedFirst ||
        String(a.courseKey).localeCompare(String(b.courseKey), undefined, { numeric: true });
    });
  }

  function selectedSections() {
    return [...pinned.entries()]
      .map(([courseKey, sectionKey]) => {
        const optionSection = planOptions[0]?.sections.find(
          (section) =>
            section.courseKey === courseKey && core.sectionKey(section) === sectionKey,
        );
        if (optionSection) {
          return optionSection;
        }
        return groups
          .find((group) => group.courseKey === courseKey)
          ?.sections.find((section) => core.sectionKey(section) === sectionKey);
      })
      .filter(Boolean);
  }

  function rerankWithFeedback() {
    clearTimeout(selectionFeedbackTimer);
    refs.resultsStep.classList.remove("is-updated");
    refs.resultsStep.classList.add("is-updating");
    refs.count.textContent = "Updating…";
    selectionFeedbackTimer = window.setTimeout(() => {
      rankOptions();
      refs.resultsStep.classList.remove("is-updating");
      refs.resultsStep.classList.add("is-updated");
      selectionFeedbackTimer = window.setTimeout(() => {
        refs.resultsStep.classList.remove("is-updated");
      }, 450);
    }, 180);
  }

  function rmpTone(value, good, middle) {
    if (value == null) {
      return "neutral";
    }
    return value >= good ? "good" : value >= middle ? "mid" : "low";
  }

  function rmpNumber(value) {
    const number = value == null ? null : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function createWeekGrid(sections) {
    const grid = document.createElement("div");
    grid.className = "ass-planner__week";
    const height = GRID_END - GRID_START;

    for (const day of DAY_KEYS) {
      const column = document.createElement("div");
      column.className = "ass-planner__week-day";
      column.appendChild(
        Object.assign(document.createElement("span"), {
          className: "ass-planner__week-label",
          textContent: DAY_LABELS[day],
        }),
      );
      const track = document.createElement("div");
      track.className = "ass-planner__week-track";
      for (const section of sections) {
        const colorIndex = courseColorIndex(section.courseKey);
        const locked = isLockedSection(section);
        for (const meeting of section.meetings || []) {
          if (
            meeting?.isTba ||
            !meeting.days.includes(day) ||
            meeting.startMinutes == null ||
            meeting.endMinutes == null
          ) {
            continue;
          }
          const top = ((meeting.startMinutes - GRID_START) / height) * 100;
          const blockHeight = ((meeting.endMinutes - meeting.startMinutes) / height) * 100;
          const block = document.createElement("div");
          block.className = [
            "ass-planner__week-block",
            `ass-planner__week-block--${colorIndex}`,
            locked ? "is-locked" : "",
          ].filter(Boolean).join(" ");
          block.dataset.assColor = String(colorIndex);
          block.style.top = `${Math.max(0, top)}%`;
          block.style.height = `${Math.max(6, blockHeight)}%`;
          block.title = [
            section.section,
            section.title,
            `${formatClock(meeting.startMinutes)}-${formatClock(meeting.endMinutes)}`,
            meeting.location,
          ].filter(Boolean).join(" · ");
          block.textContent = formatClock(meeting.startMinutes);
          track.appendChild(block);
        }
      }
      column.appendChild(track);
      grid.appendChild(column);
    }
    return grid;
  }

  function digText(source, paths) {
    for (const path of paths) {
      let value = source;
      for (const key of path.split(".")) {
        value = value?.[key];
      }
      const text = normalizeText(value);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function formatSbClock(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length < 3) {
      return "";
    }
    const padded = digits.padStart(4, "0");
    let hour = Number(padded.slice(0, 2));
    const minute = padded.slice(2, 4);
    if (!Number.isFinite(hour)) {
      return "";
    }
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
  }

  function formatSbExam(raw) {
    const text = normalizeText(raw);
    if (!text) {
      return "";
    }
    const match = text.match(
      /([A-Za-z]+),\s*(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?/,
    );
    if (!match) {
      return text;
    }
    const months = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };
    const month = months[match[1].toLowerCase()];
    if (!month) {
      return text;
    }
    let hour = Number(match[4]);
    const minute = match[5];
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${month}/${Number(match[2])}/${match[3]} ${hour}:${minute} ${suffix}`;
  }

  function sbTimeRange(meeting) {
    if (!meeting || meeting.isTba) {
      return "TBA";
    }
    if (meeting.startTime || meeting.endTime) {
      const start = formatSbClock(meeting.startTime);
      const end = formatSbClock(meeting.endTime);
      return start && end ? `${start} - ${end}` : "TBA";
    }
    if (meeting.startMinutes == null || meeting.endMinutes == null) {
      return "TBA";
    }
    const pretty = (minutes) => {
      let hour = Math.floor(minutes / 60);
      const minute = String(minutes % 60).padStart(2, "0");
      const suffix = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${suffix}`;
    };
    return `${pretty(meeting.startMinutes)} - ${pretty(meeting.endMinutes)}`;
  }

  function sbLocation(meeting) {
    if (!meeting || meeting.isTba) {
      return "TBA";
    }
    const building = normalizeText(meeting.building);
    const room = normalizeText(meeting.room);
    if (building || room) {
      return [building, room].filter(Boolean).join(" ");
    }
    return normalizeText(meeting.location) || "TBA";
  }

  function appendDetailField(parent, label, valueNode) {
    if (!valueNode) {
      return;
    }
    const row = document.createElement("div");
    row.className = "ass-planner__sb-field";
    const dt = document.createElement("span");
    dt.className = "ass-planner__sb-label";
    dt.textContent = `${label}:`;
    const dd = document.createElement("div");
    dd.className = "ass-planner__sb-value";
    if (typeof valueNode === "string") {
      dd.textContent = valueNode;
    } else {
      dd.appendChild(valueNode);
    }
    row.append(dt, dd);
    parent.appendChild(row);
  }

  function createRmpCard(rmp) {
    if (!rmp || rmp.miss) {
      return null;
    }
    const card = document.createElement("div");
    card.className = "ass-planner__sb-rmp";
    card.appendChild(
      Object.assign(document.createElement("div"), {
        className: "ass-planner__sb-rmp-head",
        textContent: "RateMyProfessors",
      }),
    );
    const rows = document.createElement("div");
    rows.className = "ass-planner__sb-rmp-rows";
    const add = (label, value, tone) => {
      if (value == null || value === "") {
        return;
      }
      const row = document.createElement("div");
      row.className = "ass-planner__sb-rmp-row";
      row.append(
        Object.assign(document.createElement("span"), { textContent: label }),
        Object.assign(document.createElement("strong"), {
          className: `ass-planner__sb-rmp-val ass-planner__sb-rmp-val--${tone}`,
          textContent: String(value),
        }),
      );
      rows.appendChild(row);
    };
    const rating = rmpNumber(rmp.rating);
    const wouldTake = rmpNumber(rmp.wouldTakeAgainPercent);
    const difficulty = rmpNumber(rmp.difficulty);
    add("Rating", rating == null ? null : rating.toFixed(1), rmpTone(rating, 4, 3));
    add(
      "Would take again",
      wouldTake == null || wouldTake < 0 ? null : `${Math.round(wouldTake)}%`,
      rmpTone(wouldTake, 70, 50),
    );
    add(
      "Difficulty",
      difficulty == null ? null : difficulty.toFixed(1),
      difficulty <= 2 ? "good" : difficulty <= 3.5 ? "mid" : "low",
    );
    card.appendChild(rows);
    const footer = document.createElement("div");
    footer.className = "ass-planner__sb-rmp-footer";
    if (rmp.profileUrl) {
      const link = document.createElement("a");
      link.href = rmp.profileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on RateMyProfessors";
      footer.appendChild(link);
    }
    const via = document.createElement("a");
    via.href = ASS.branding?.shareUrl || "https://ass.vijit.app";
    via.target = "_blank";
    via.rel = "noopener noreferrer";
    via.className = "ass-planner__sb-rmp-via";
    via.textContent = "via ass.vijit.app";
    footer.appendChild(via);
    card.appendChild(footer);
    return card;
  }

  function meetingsFromDetails(details, fallbackSection) {
    const rawMeetings = Array.isArray(details?.meeting) ? details.meeting : null;
    if (rawMeetings?.length) {
      return rawMeetings.map((meeting) => ({
        type: normalizeText(meeting.description || meeting.type || meeting.meetCode) || "Meeting",
        days: normalizeText(meeting.daysString) ||
          ["M", "T", "W", "R", "F"]
            .filter((day, index) =>
              [meeting.monday, meeting.tuesday, meeting.wednesday, meeting.thursday, meeting.friday][index],
            )
            .join(""),
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        building: meeting.building,
        room: meeting.room,
        isTba: !meeting.startTime && !meeting.endTime,
      }));
    }
    return (fallbackSection.meetings || []).map((meeting) => ({
      type: meeting.type || "Meeting",
      days: Array.isArray(meeting.days) ? meeting.days.join("") : "",
      startMinutes: meeting.startMinutes,
      endMinutes: meeting.endMinutes,
      location: meeting.location,
      isTba: meeting.isTba,
    }));
  }

  function renderScheduleBuilderDetails(section, details) {
    refs.detailsBody.replaceChildren();
    const course = details?.course || {};

    const instructorsWrap = document.createElement("div");
    instructorsWrap.className = "ass-planner__sb-instructors";
    const label = document.createElement("span");
    label.className = "ass-planner__sb-inline-label";
    label.textContent = "Instructor(s):";
    instructorsWrap.appendChild(label);
    const names = [];
    const rawInstructors = Array.isArray(details?.instructor) ? details.instructor : [];
    if (rawInstructors.length) {
      for (const item of rawInstructors) {
        const name = normalizeText(item.instructorName) || "TBA";
        const email = normalizeText(item.instructorEmail);
        if (email) {
          const link = document.createElement("a");
          link.href = `mailto:${email}`;
          link.textContent = name;
          names.push(link);
        } else {
          names.push(document.createTextNode(name));
        }
      }
    } else {
      const fallback =
        section.selectedInstructor || section.instructors?.[0] || { displayName: "TBA" };
      names.push(document.createTextNode(fallback.displayName || "TBA"));
    }
    names.forEach((node, index) => {
      if (index) {
        instructorsWrap.appendChild(document.createTextNode(", "));
      }
      instructorsWrap.appendChild(node);
    });
    refs.detailsBody.appendChild(instructorsWrap);

    const primary =
      section.selectedInstructor ||
      section.instructors?.[0] ||
      null;
    const rmpCard = createRmpCard(primary?.rmp);
    if (rmpCard) {
      refs.detailsBody.appendChild(rmpCard);
    }

    const fields = document.createElement("div");
    fields.className = "ass-planner__sb-fields";
    const description = digText(details, [
      "icmsData.newDescription",
      "icmsData.description",
      "course.description",
      "course.courseDesc",
      "course.courseDescription",
    ]);
    if (description) {
      appendDetailField(fields, "Description", description);
    }
    const ge = digText(details, [
      "icmsData.geCredit",
      "icmsData.geCourses",
      "course.geCredit",
      "course.geCourses",
    ]);
    if (ge) {
      appendDetailField(fields, "GE Courses", ge);
    }
    const formerGe = digText(details, [
      "icmsData.formerGeCredit",
      "icmsData.oldGeCredit",
      "course.formerGeCredit",
    ]);
    if (formerGe) {
      appendDetailField(
        fields,
        "Former GE Credit (Prior to 2011 catalog rights)",
        formerGe,
      );
    }
    const finalExam = formatSbExam(
      digText(details, ["finalExam.examDate", "finalExam.date", "course.finalExam"]),
    );
    if (finalExam) {
      appendDetailField(fields, "Final Exam", finalExam);
    }
    const bookstore =
      digText(details, [
        "course.bookstoreUrl",
        "course.bookstoreURL",
        "bookstoreUrl",
        "bookstoreURL",
        "icmsData.bookstoreUrl",
      ]) || "https://ucdavisstores.com/";
    const materials = document.createElement("a");
    materials.href = bookstore;
    materials.target = "_blank";
    materials.rel = "noopener noreferrer";
    materials.textContent = "UC Davis Bookstore";
    appendDetailField(fields, "Course Materials", materials);

    const dropDate = digText(details, [
      "course.dropDate",
      "course.courseDropDate",
      "course.dropDeadline",
      "dropDate",
      "icmsData.dropDate",
    ]);
    if (dropDate) {
      appendDetailField(fields, "Course Drop Date", dropDate);
    }

    const catalog =
      digText(details, [
        "icmsData.catalogUrl",
        "icmsData.catalogURL",
        "course.catalogUrl",
        "course.catalogURL",
        "catalogUrl",
      ]) ||
      (course.subjectCode && course.courseNum
        ? `https://catalog.ucdavis.edu/search/?P=${encodeURIComponent(
            `${course.subjectCode} ${course.courseNum}`,
          )}`
        : "");
    if (catalog) {
      const catalogLink = document.createElement("a");
      catalogLink.className = "ass-planner__sb-catalog";
      catalogLink.href = catalog;
      catalogLink.target = "_blank";
      catalogLink.rel = "noopener noreferrer";
      catalogLink.textContent = "View the UC Davis online catalog";
      fields.appendChild(catalogLink);
    }
    refs.detailsBody.appendChild(fields);

    const table = document.createElement("table");
    table.className = "ass-planner__sb-meetings";
    const body = document.createElement("tbody");
    for (const meeting of meetingsFromDetails(details, section)) {
      const row = document.createElement("tr");
      for (const cellText of [
        meeting.type || "Meeting",
        sbTimeRange(meeting),
        meeting.days || "",
        sbLocation(meeting),
      ]) {
        row.appendChild(
          Object.assign(document.createElement("td"), { textContent: cellText }),
        );
      }
      body.appendChild(row);
    }
    if (!body.childElementCount) {
      const row = document.createElement("tr");
      row.appendChild(
        Object.assign(document.createElement("td"), {
          colSpan: 4,
          textContent: "No meeting times listed",
        }),
      );
      body.appendChild(row);
    }
    table.appendChild(body);
    refs.detailsBody.appendChild(table);
  }

  async function openDetails(section) {
    refs.details.hidden = false;
    refs.detailsBody.replaceChildren(
      Object.assign(document.createElement("p"), {
        className: "ass-planner__details-loading",
        textContent: "Loading course details…",
      }),
    );
    const crn = core.sectionKey(section) || section.crn;
    const response = await pageRequest("get_course_details", { crn });
    if (!response.ok) {
      // Fall back to whatever the planner already knows so More details still works.
      renderScheduleBuilderDetails(section, {
        course: {
          subjectCode: section.courseKey?.split(" ")[0],
          courseNum: section.courseKey?.split(" ")[1],
          shortDesc: section.section,
          title: section.title,
          printCRN: section.crn,
        },
        instructor: (section.instructors || []).map((item) => ({
          instructorName: item.displayName,
        })),
        meeting: [],
        finalExam: null,
        icmsData: null,
      });
      return;
    }
    renderScheduleBuilderDetails(section, response.details || {});
  }

  function closeDetails() {
    refs.details.hidden = true;
    refs.detailsBody.replaceChildren();
  }

  function createDetailsButton(section) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ass-planner__link-btn";
    button.textContent = "More details";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void openDetails(section);
    });
    return button;
  }

  function createCourseBox(section) {
    const colorIndex = courseColorIndex(section.courseKey);
    const selected = isLockedSection(section);
    const box = document.createElement("article");
    box.className = `ass-planner__course-box${selected ? " is-selected" : ""}`;
    box.dataset.assColor = String(colorIndex);
    box.tabIndex = 0;
    box.setAttribute("role", "button");
    box.setAttribute("aria-pressed", String(selected));

    const head = document.createElement("div");
    head.className = "ass-planner__course-box-head";
    head.append(
      Object.assign(document.createElement("span"), {
        className: `ass-planner__swatch ass-planner__swatch--${colorIndex}`,
      }),
      Object.assign(document.createElement("strong"), { textContent: section.section }),
    );

    const title = Object.assign(document.createElement("p"), {
      className: "ass-planner__course-box-title",
      textContent: section.title || "",
    });

    const instructor =
      section.selectedInstructor ||
      section.instructors?.[0] || { displayName: "TBA", rmp: null };
    const seats = core.seatSummary(section);
    const meta = document.createElement("div");
    meta.className = "ass-planner__course-box-meta";
    meta.append(
      Object.assign(document.createElement("span"), { textContent: instructor.displayName }),
      badge(seats.label, seats.tone),
    );
    const rating = rmpNumber(instructor.rmp?.rating);
    if (rating != null) {
      meta.appendChild(badge(rating.toFixed(1), rmpTone(rating, 4, 3)));
    }

    const foot = document.createElement("div");
    foot.className = "ass-planner__course-box-foot";
    const actions = document.createElement("div");
    actions.className = "ass-planner__course-box-actions";
    const select = document.createElement("button");
    select.type = "button";
    select.className = `ass-planner__course-select${selected ? " is-selected" : ""}`;
    select.textContent = selected ? "Selected" : "Select";

    const toggle = () => {
      if (selected) {
        pinned.delete(section.courseKey);
      } else {
        pinned.set(section.courseKey, core.sectionKey(section));
      }
      rerankWithFeedback();
    };
    select.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
    });
    box.addEventListener("click", (event) => {
      if (!event.target.closest("button,a")) {
        toggle();
      }
    });
    box.addEventListener("keydown", (event) => {
      if (event.target === box && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        toggle();
      }
    });

    actions.append(select, createDetailsButton(section));
    foot.append(
      Object.assign(document.createElement("small"), { textContent: `CRN ${section.crn}` }),
      actions,
    );

    box.append(head, title, meta, foot);
    return box;
  }

  function createOptionIssues(option) {
    const issues = document.createElement("div");
    issues.className = "ass-planner__issues";
    for (const [first, second] of option.overlaps) {
      issues.appendChild(badge(`${first} ↔ ${second}`, "low"));
    }
    for (const section of option.sections) {
      if (section.limits.includes("existingConflict")) {
        issues.appendChild(badge(`${section.section} clashes`, "low"));
      }
      if (section.limits.includes("closed")) {
        issues.appendChild(badge(`${section.section} full`, "low"));
      }
      if (section.limits.includes("waitlist")) {
        issues.appendChild(badge(`${section.section} waitlist`, "mid"));
      }
    }
    issues.hidden = !issues.childElementCount;
    return issues;
  }

  function bindHoverSync(root) {
    root.addEventListener("mouseover", (event) => {
      const target = event.target.closest("[data-ass-color]");
      root.querySelectorAll(".is-hot").forEach((node) => node.classList.remove("is-hot"));
      if (!target) {
        return;
      }
      root
        .querySelectorAll(`[data-ass-color="${target.dataset.assColor}"]`)
        .forEach((node) => node.classList.add("is-hot"));
    });
    root.addEventListener("mouseleave", () => {
      root.querySelectorAll(".is-hot").forEach((node) => node.classList.remove("is-hot"));
    });
  }

  function createSelectedPanel(sections) {
    const panel = document.createElement("div");
    panel.className = "ass-planner__selected";
    const ordered = orderedSections(sections);

    const head = document.createElement("div");
    head.className = "ass-planner__selected-head";
    head.append(
      Object.assign(document.createElement("strong"), {
        textContent: "Selected schedule",
      }),
      Object.assign(document.createElement("span"), {
        textContent: `${ordered.length}/${groups.length}`,
      }),
    );

    const cal = document.createElement("div");
    cal.className = "ass-planner__selected-cal";
    cal.appendChild(createWeekGrid(ordered));

    const courses = document.createElement("div");
    courses.className = "ass-planner__selected-courses";
    for (const section of ordered) {
      courses.appendChild(createCourseBox(section));
    }

    panel.append(head, cal, courses);
    bindHoverSync(panel);
    return panel;
  }

  function createOptionCard(option, index) {
    const card = document.createElement("article");
    card.className = `ass-planner__card${index === 0 ? " is-best" : ""}`;

    const head = document.createElement("header");
    head.className = "ass-planner__card-head";
    head.append(
      Object.assign(document.createElement("span"), {
        className: "ass-planner__rank",
        textContent: index === 0
          ? option.limits.length ? "Closest" : "Best"
          : `#${index + 1}`,
      }),
      Object.assign(document.createElement("span"), {
        className: "ass-planner__stats",
        textContent: [
          `${Math.round(option.timeMatch * 100)}%`,
          option.averageRating == null ? null : `${option.averageRating.toFixed(1)}★`,
        ].filter(Boolean).join(" · "),
      }),
    );

    const body = document.createElement("div");
    body.className = "ass-planner__card-body";
    const allSections = orderedSections(option.sections);
    const sections = orderedSections(
      option.sections.filter((section) => !pinned.has(section.courseKey)),
    );
    body.appendChild(createWeekGrid(allSections));

    const list = document.createElement("div");
    list.className = "ass-planner__card-courses";
    for (const section of sections) {
      list.appendChild(createCourseBox(section));
    }
    body.appendChild(list);
    bindHoverSync(body);

    card.append(head, createOptionIssues(option), body);
    return card;
  }

  function renderOptions() {
    renderBanner();
    refs.pinned.replaceChildren();
    const selected = selectedSections();
    if (selected.length) {
      refs.pinned.hidden = false;
      refs.pinned.appendChild(createSelectedPanel(selected));
    } else {
      refs.pinned.hidden = true;
    }
    const complete = groups.length > 0 && pinned.size === groups.length;
    refs.cards.replaceChildren(
      ...(complete ? [] : planOptions.map(createOptionCard)),
    );
    refs.count.textContent = complete
      ? "Ready to save"
      : `${planOptions.length} ${planOptions.length === 1 ? "option" : "options"}`;
    syncToolbar();
  }

  function rankFailureMessage(result) {
    return result.reason === "no_sections"
      ? `No sections loaded for ${result.courseKey}.`
      : "Too many combinations. Remove a course.";
  }

  function rankOptions() {
    const result = core.generateSchedules(groups, {
      preferences,
      ratingWeight,
      includeWaitlist,
      pinned,
    });
    if (!result.ok) {
      planOptions = [];
      setStatus(rankFailureMessage(result), "error");
      syncToolbar();
      return false;
    }
    planOptions = result.options;
    searchTruncated = result.truncated;
    setStatus("");
    renderOptions();
    return true;
  }

  async function loadSections() {
    const codes = selectedCourses.map((course) => course.courseKey);
    const nextGroups = [];
    const missing = [];

    for (let index = 0; index < codes.length; index += 1) {
      const code = codes[index];
      setStatus(`Loading ${code} (${index + 1} of ${codes.length})…`, "info");
      const response = await pageRequest(
        "search_courses",
        { query: code, resetMemory: index === 0 },
        (progress) => {
          if (progress?.stage === "seats") {
            setStatus(`Checking seats for ${code} (${progress.completed}/${progress.total})…`, "info");
          }
        },
      );
      if (!response.ok) {
        throw new Error(`${code}: ${describeError(response.error)}`);
      }
      const byKey = new Map();
      for (const raw of response.results || []) {
        const section = core.normalizeSearchResult(raw);
        const key = section.saveKey || section.crn;
        if (section.courseKey === code && !byKey.has(key)) {
          byKey.set(key, section);
        }
      }
      if (byKey.size) {
        nextGroups.push({ courseKey: code, sections: [...byKey.values()] });
      } else {
        missing.push(code);
      }
    }

    if (!nextGroups.length) {
      throw new Error(`Not offered this term: ${missing.join(", ")}.`);
    }
    groups = nextGroups;
    loadedCourseKey = courseSetKey();
    return missing;
  }

  async function loadRatings() {
    const names = new Set();
    for (const group of groups) {
      for (const section of group.sections) {
        for (const instructor of section.instructors) {
          names.add(instructor.displayName);
        }
      }
    }
    setStatus("Loading professor ratings…", "info");
    const ratings = new Map();
    await Promise.all(
      [...names].map(async (name) => {
        const entry = await api.getProfessorRating(name);
        ratings.set(name, entry?.miss ? null : entry);
      }),
    );
    for (const group of groups) {
      for (const section of group.sections) {
        for (const instructor of section.instructors) {
          instructor.rmp = ratings.get(instructor.displayName) || null;
        }
      }
    }
  }

  async function findSchedules() {
    if (busy) {
      return;
    }
    chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
    setBusy(true);
    api.snipeLog?.("[advanced_planner]", {
      action: "find_start",
      courseCount: selectedCourses.length,
      ratingWeight,
      includeWaitlist,
      days: preferences.days || [],
    });
    try {
      let missing = [];
      if (loadedCourseKey !== courseSetKey()) {
        missing = await loadSections();
        await loadRatings();
      }
      setStatus("Checking every combination…", "info");
      if (!rankOptions()) {
        api.snipeLog?.("[advanced_planner]", {
          action: "find_complete",
          ok: false,
          courseCount: selectedCourses.length,
          missingCount: missing.length,
        });
        return;
      }
      showStep("results");
      api.snipeLog?.("[advanced_planner]", {
        action: "find_complete",
        ok: true,
        courseCount: selectedCourses.length,
        optionCount: planOptions.length,
        missingCount: missing.length,
      });
      if (missing.length) {
        setStatus(`Not offered this term: ${missing.join(", ")}.`, "info");
      }
    } catch (error) {
      api.snipeLog?.("[advanced_planner]", {
        action: "find_complete",
        ok: false,
        error: describeError(error),
      });
      setStatus(describeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(option) {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus("Saving…", "info");
    const keys = option.sections.map(core.sectionKey);
    api.snipeLog?.("[advanced_planner]", {
      action: "save_start",
      sectionCount: keys.length,
    });
    try {
      const response = await pageRequest("save_courses", { crns: keys });
      if (!response.ok) {
        throw new Error(describeError(response.error));
      }
      const failed = (response.results || []).filter((item) => !item.ok);
      const saved = (response.results || []).length - failed.length;
      api.snipeLog?.("[advanced_planner]", {
        action: "save_complete",
        ok: failed.length === 0,
        saved,
        failed: failed.length,
      });
      setStatus(
        failed.length
          ? [
              saved ? `Saved ${saved} of ${response.results.length}.` : "",
              ...failed.map((item) => item.error || `${item.courseKey || item.crn} failed.`),
            ].filter(Boolean).join(" ")
          : "Saved to your schedule.",
        failed.length ? "error" : "success",
      );
    } catch (error) {
      api.snipeLog?.("[advanced_planner]", {
        action: "save_complete",
        ok: false,
        error: describeError(error),
      });
      setStatus(describeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  // --- Wiring -----------------------------------------------------------

  function bindEvents() {
    refs.close.addEventListener("click", closeModal);
    refs.continue.addEventListener("click", () => {
      renderTimeStep();
      showStep("time");
    });
    refs.toCourses.addEventListener("click", () => {
      showStep("courses");
      refs.courseInput.focus();
    });
    refs.toDays.addEventListener("click", () => {
      renderDayStep();
      showStep("days");
    });
    refs.backToTime.addEventListener("click", () => {
      renderTimeStep();
      showStep("time");
    });
    refs.toBalance.addEventListener("click", () => {
      refs.balanceBody.appendChild(balanceControl);
      showStep("balance");
    });
    refs.backToDays.addEventListener("click", () => {
      renderDayStep();
      showStep("days");
    });
    refs.find.addEventListener("click", findSchedules);
    refs.editPreferences.addEventListener("click", () => {
      closeDetails();
      renderTimeStep();
      showStep("time");
    });
    refs.changeCourses.addEventListener("click", () => {
      closeDetails();
      showStep("courses");
      refs.courseInput.focus();
    });
    refs.save.addEventListener("click", () => {
      const sections = selectedSections();
      if (sections.length !== groups.length) {
        return;
      }
      void savePlan({ sections });
    });
    refs.detailsBack.addEventListener("click", closeDetails);
    refs.chips.addEventListener("click", (event) => {
      const courseKey = event.target.closest("[data-ass-remove-course]")?.dataset.assRemoveCourse;
      if (courseKey) {
        removeCourse(courseKey);
      }
    });
    refs.courseInput.addEventListener("input", () => {
      clearTimeout(suggestionTimer);
      const query = refs.courseInput.value;
      suggestionTimer = window.setTimeout(() => void loadSuggestions(query), SUGGESTION_DEBOUNCE_MS);
    });
    refs.courseInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (suggestions.length) {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          activeSuggestionIndex =
            (activeSuggestionIndex + delta + suggestions.length) % suggestions.length;
          renderSuggestions();
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        addCourse(suggestions[activeSuggestionIndex]);
      } else if (event.key === "Backspace" && !refs.courseInput.value && selectedCourses.length) {
        removeCourse(selectedCourses[selectedCourses.length - 1].courseKey);
      }
    });
    refs.suggestions.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const index = event.target.closest("[data-ass-suggestion-index]")?.dataset.assSuggestionIndex;
      addCourse(suggestions[Number(index)]);
    });

    root.addEventListener("click", (event) => {
      if (event.target === root) {
        closeModal();
      } else if (!event.target.closest(".ass-planner__course-field")) {
        closeSuggestions();
      }
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (refs.suggestions.hidden) {
        closeModal();
      } else {
        closeSuggestions();
      }
    });
  }

  function createUi() {
    if (!document.getElementById("ass-planner-styles")) {
      const style = document.createElement("style");
      style.id = "ass-planner-styles";
      style.textContent = ASS.plannerStyles || "";
      document.head.appendChild(style);
    }

    root = document.createElement("div");
    root.id = "ass-advanced-planner";
    root.className = "ass-planner-backdrop";
    root.innerHTML = `
      <section class="ass-planner" role="dialog" aria-modal="true" aria-labelledby="ass-planner-title">
        <header class="ass-planner__head">
          <div class="ass-planner__brand">
            <div class="ass-planner__brand-row">
              <img class="ass-planner__logo" alt="" width="28" height="28" />
              <h2 class="ass-planner__title" id="ass-planner-title">Advanced Planner</h2>
            </div>
            <p class="ass-planner__subtitle">Select the courses you want, &amp; find the perfect schedule for you based on your preferences <em class="ass-planner__subtitle-em">across all combinations</em> of courses!</p>
            <a class="ass-planner__via" target="_blank" rel="noopener noreferrer">via ass.vijit.app</a>
          </div>
          <button type="button" class="ass-planner__close" aria-label="Close">×</button>
        </header>

        <div class="ass-planner__body">
          <div data-ass-step="courses">
            <label class="ass-planner__label" for="ass-planner-course">Which courses do you want?</label>
            <div class="ass-planner__course-field">
              <div class="ass-planner__input">
                <span class="ass-planner__chips"></span>
                <input id="ass-planner-course" type="text" autocomplete="off" placeholder="e.g. CHE 002A" />
              </div>
              <div class="ass-planner__suggestions" hidden></div>
            </div>
            <div class="ass-planner__actions">
              <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="continue" disabled>Continue</button>
            </div>
          </div>

          <div data-ass-step="time" hidden>
            <p class="ass-planner__step-count">Step 1 of 3</p>
            <h3 class="ass-planner__question">What times do you prefer your classes to be?</h3>
            <div class="ass-planner__sliders">
              <div class="ass-planner__slider-scale"><span></span><span><span>Not ideal</span><span>Perfect</span></span></div>
              <div data-ass-slot="time"></div>
            </div>
            <div class="ass-planner__actions">
              <button type="button" class="ass-planner__btn" data-ass-action="to-courses">Back</button>
              <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="to-days">Next</button>
            </div>
          </div>

          <div data-ass-step="days" hidden>
            <p class="ass-planner__step-count">Step 2 of 3</p>
            <h3 class="ass-planner__question">Which days do you prefer your classes to be?</h3>
            <div class="ass-planner__sliders">
              <div class="ass-planner__slider-scale"><span></span><span><span>Not ideal</span><span>Perfect</span></span></div>
              <div data-ass-slot="days"></div>
            </div>
            <div class="ass-planner__actions">
              <button type="button" class="ass-planner__btn" data-ass-action="back-to-time">Back</button>
              <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="to-balance">Next</button>
            </div>
          </div>

          <div data-ass-step="balance" hidden>
            <p class="ass-planner__step-count">Step 3 of 3</p>
            <h3 class="ass-planner__question">What matters more?</h3>
            <div class="ass-planner__sliders" data-ass-slot="balance"></div>
            <p class="ass-planner__note">We rank by your preferences first, but seats and class times are set by UC Davis. If nothing open matches, we still show the closest schedules that actually work.</p>
            <div class="ass-planner__actions">
              <button type="button" class="ass-planner__btn" data-ass-action="back-to-days">Back</button>
              <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="find">Find my schedule</button>
            </div>
          </div>

          <div data-ass-step="results" hidden>
            <div class="ass-planner__results-toolbar">
              <p class="ass-planner__count"></p>
              <div class="ass-planner__results-actions">
                <button type="button" class="ass-planner__btn" data-ass-action="change-courses">Courses</button>
                <button type="button" class="ass-planner__btn" data-ass-action="edit-preferences">Preferences</button>
                <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="save">Save</button>
              </div>
            </div>
            <p class="ass-planner__banner" hidden></p>
            <div class="ass-planner__pinned" hidden></div>
            <div class="ass-planner__cards"></div>
          </div>

          <p class="ass-planner__status" role="status" aria-live="polite"></p>
        </div>

        <div class="ass-planner__details" hidden>
          <div class="ass-planner__details-bar">
            <button type="button" class="ass-planner__btn" data-ass-action="details-back">Back</button>
          </div>
          <div class="ass-planner__details-body"></div>
        </div>
      </section>
    `;

    const logo = root.querySelector(".ass-planner__logo");
    logo.src = chrome.runtime.getURL("128.png");
    const via = root.querySelector(".ass-planner__via");
    via.href = ASS.branding?.shareUrl || "https://ass.vijit.app";

    const action = (name) => root.querySelector(`[data-ass-action='${name}']`);
    refs = {
      close: root.querySelector(".ass-planner__close"),
      continue: action("continue"),
      toCourses: action("to-courses"),
      toDays: action("to-days"),
      backToTime: action("back-to-time"),
      toBalance: action("to-balance"),
      backToDays: action("back-to-days"),
      find: action("find"),
      changeCourses: action("change-courses"),
      editPreferences: action("edit-preferences"),
      save: action("save"),
      detailsBack: action("details-back"),
      details: root.querySelector(".ass-planner__details"),
      detailsBody: root.querySelector(".ass-planner__details-body"),
      pinned: root.querySelector(".ass-planner__pinned"),
      resultsStep: root.querySelector("[data-ass-step='results']"),
      courseInput: root.querySelector("#ass-planner-course"),
      chips: root.querySelector(".ass-planner__chips"),
      suggestions: root.querySelector(".ass-planner__suggestions"),
      timeBody: root.querySelector("[data-ass-slot='time']"),
      dayBody: root.querySelector("[data-ass-slot='days']"),
      balanceBody: root.querySelector("[data-ass-slot='balance']"),
      banner: root.querySelector(".ass-planner__banner"),
      count: root.querySelector(".ass-planner__count"),
      cards: root.querySelector(".ass-planner__cards"),
      status: root.querySelector(".ass-planner__status"),
    };

    bindEvents();
    renderCourses();
    chrome.storage.local.get([COURSES_KEY, PREFERENCES_KEY], (stored) => {
      selectedCourses = (Array.isArray(stored?.[COURSES_KEY]) ? stored[COURSES_KEY] : [])
        .map((course) => ({
          courseKey: core.parseCourseCodes(course?.courseKey)?.[0] || null,
          title: normalizeText(course?.title),
        }))
        .filter((course) => course.courseKey);
      preferences = core.normalizeSchedulerPreferences(stored?.[PREFERENCES_KEY]);
      renderCourses();
    });
    balanceControl = createBalanceControl();
    return root;
  }

  function openModal(options = {}) {
    if (!options.force && ASS.state.settings.showAdvancedPlanner === false) {
      api.snipeLog?.("[advanced_planner]", {
        action: "open",
        ok: false,
        skipReason: "hidden_by_setting",
        force: !!options.force,
      });
      return false;
    }
    api.closeSettingsPanel?.();
    api.closeDeveloperPanel?.();
    if (!root || !document.contains(root)) {
      root = null;
      document.body.appendChild(createUi());
      showStep("courses");
    }
    root.hidden = false;
    window.requestAnimationFrame(() => refs.courseInput.focus());
    api.snipeLog?.("[advanced_planner]", {
      action: "open",
      ok: true,
      force: !!options.force,
      courseCount: selectedCourses.length,
    });
    return true;
  }

  function closeModal() {
    clearTimeout(suggestionTimer);
    clearTimeout(selectionFeedbackTimer);
    if (root) {
      closeSuggestions();
      closeDetails();
      refs.resultsStep.classList.remove("is-updating", "is-updated");
      root.hidden = true;
      api.snipeLog?.("[advanced_planner]", { action: "close" });
    }
  }

  function createLauncher() {
    const button = api.createStyledElement(
      "button",
      [
        "display:inline-flex",
        "align-items:center",
        "gap:8px",
        "flex:0 0 auto",
        "margin:0 0 0 10px",
        "padding:9px 18px",
        "min-height:38px",
        "box-sizing:border-box",
        "border-radius:999px",
        "border:1px solid #d2dbe8",
        "background:#f8fafc",
        "color:#01256e",
        "font:700 14px Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
        "cursor:pointer",
        "vertical-align:middle",
        "white-space:nowrap",
        "box-shadow:0 1px 3px rgba(1,37,110,.12)",
      ].join(";"),
    );
    button.id = "assAdvancedPlannerBtn";
    button.type = "button";
    button.title = "Open Advanced Planner";

    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("128.png");
    logo.alt = "";
    logo.style.cssText = "width:20px;height:20px;border-radius:4px;object-fit:cover;flex-shrink:0;";
    button.append(logo, document.createTextNode("Advanced Planner"));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openModal();
    });
    return button;
  }

  function findSearchButton() {
    const form = document.querySelector("#inline_course_search_form");
    const controls = form?.querySelectorAll("button, input[type='submit'], input[type='button']");
    return [...(controls || [])].find((control) =>
      /search/i.test(control.value || control.textContent || ""),
    );
  }

  function ensureAdvancedPlannerUi() {
    const searchButton = findSearchButton();
    if (!searchButton || launcher?.previousElementSibling === searchButton) {
      return;
    }
    launcher = launcher || createLauncher();
    // Drop in right after SEARCH without restyling anything Schedule Builder
    // owns; its search group wraps, so constraining it moves SEARCH to its
    // own line.
    searchButton.insertAdjacentElement("afterend", launcher);
  }

  function removeAdvancedPlannerUi() {
    closeModal();
    root?.remove();
    root = null;
    document.getElementById("ass-planner-styles")?.remove();
    launcher?.remove();
    launcher = null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ASS_OPEN_ADVANCED_PLANNER") {
      sendResponse({ ok: openModal({ force: !!message.force }) });
    }
    return false;
  });

  Object.assign(api, {
    ensureAdvancedPlannerUi,
    removeAdvancedPlannerUi,
    openAdvancedPlannerModal: openModal,
  });
})();
