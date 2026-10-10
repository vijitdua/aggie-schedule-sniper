(() => {
  const { api } = window.ASS;
  const core = window.ASS_SCHEDULER_CORE;
  const travel = window.ASS_TRAVEL_ESTIMATES;
  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const DAYS = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat", U: "Sun" };
  const ICONS = {
    walking: '<circle cx="13" cy="4" r="2"/><path d="m7 21 3-6m6 6-2-7-3-3 1-4m-6 6 3-5 3-1 3 5 3 1"/>',
    cycling: '<circle cx="5.5" cy="17" r="4"/><circle cx="18.5" cy="17" r="4"/><path d="m15 6 2 3m-10 8 5-8 4 8M8 9h4m3-6h2l2 14M6 6h3"/>',
  };
  function ensureStyles() {
    if (document.getElementById("ass-travel-styles")) return;
    const style = document.createElement("style");
    style.id = "ass-travel-styles";
    style.textContent = `
      .ass-travel-notes { margin: 8px 14px; color: #51627d; font: 12px/1.6 system-ui, sans-serif; overflow-wrap: anywhere; }
      .ass-travel-notes[hidden] { display: none !important; }
      .ass-travel-note { margin: 4px 0; }
      .ass-travel-note__route { font-weight: 500; }
      .ass-travel-note__mode { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
      .ass-travel-note svg { width: 14px; height: 14px; flex-shrink: 0; }
      .ass-travel-note__status--good { color: #166534; }
      .ass-travel-note__status--tight { color: #92400e; }
      .ass-travel-note__status--short { color: #9f1239; }
      .ass-travel-notes--schedule { margin: 0; padding: 6px 12px; border-bottom: 1px solid #eef2f7; }
    `;
    (document.head || document.documentElement).append(style);
  }
  function modeText(mode, minutes) {
    const span = document.createElement("span");
    span.className = "ass-travel-note__mode";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) {
      icon.setAttribute(name, value);
    }
    icon.innerHTML = ICONS[mode];
    span.append(icon, `${mode === "walking" ? "Walk" : "Bike"} ~${minutes} min`);
    return span;
  }
  function transfersFor(sections) {
    // Combine identical course pairs across weekdays into one quiet note.
    const grouped = new Map();
    for (const transfer of core.shortTransfers(sections)) {
      const { from, to, gap, day } = transfer;
      const key = JSON.stringify([from.section.courseKey, to.section.courseKey, from.location, to.location, from.endMinutes, to.startMinutes, gap]);
      if (!grouped.has(key)) grouped.set(key, { ...transfer, days: [], assessment: travel.assessTransfer(from, to, gap) });
      grouped.get(key).days.push(day);
    }
    return [...grouped.values()];
  }
  function transferNote(transfer) {
    const { from, to, gap, days, assessment } = transfer;
    const note = document.createElement("p");
    note.className = "ass-travel-note";
    const route = document.createElement("span");
    route.className = "ass-travel-note__route";
    route.textContent = `${days.map(day => DAYS[day]).join("/")} · ${assessment?.isTight ? "Tight transfer: " : ""}${from.section.courseKey} → ${to.section.courseKey} (${gap} min gap)`;
    note.title = `${normalizeText(from.location) || "TBA"} → ${normalizeText(to.location) || "TBA"}. Estimated travel time, including classroom changes and bike parking.`;
    note.append(route, " · ");
    if (!assessment) {
      note.append("travel time unavailable");
    } else {
      if (assessment.sameBuilding) {
        note.append(`Room change ~${assessment.walking} min`);
      } else {
        note.append(modeText("walking", assessment.walking), " · ", modeText("cycling", assessment.cycling));
      }
      const status = document.createElement("span");
      status.className = `ass-travel-note__status--${assessment.tone}`;
      status.textContent = assessment.status;
      note.append(" · ", status);
    }
    return note;
  }
  function createTravelPanel(sections) {
    ensureStyles();
    const notes = document.createElement("div");
    notes.className = "ass-travel-notes";
    notes.setAttribute("aria-label", "Tight transfers between classes");
    // Planner cards need only actionable tight-transfer notes, not every short gap.
    for (const transfer of transfersFor(sections)) {
      if (transfer.assessment?.isTight) notes.append(transferNote(transfer));
    }
    notes.hidden = !notes.childElementCount;
    return notes;
  }

  let lastSignature = "";
  let inserted = [];
  function minutes(clock) {
    const match = String(clock || "").match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match) return null;
    return (Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(match[2]);
  }
  function syncScheduleTravelReminders() {
    const list = document.getElementById("SavedSchedulesListDisplayContainer");
    if (!list) {
      inserted.forEach(({ note }) => note.remove());
      inserted = []; lastSignature = ""; return;
    }
    const schedule = api.parseScheduleFromDom({ includeUnregistered: true });
    const cards = [...list.querySelectorAll("article.CourseItem")];
    const sections = schedule.courses.map((course) => ({
      courseKey: course.codeSection,
      meetings: course.meetings.map((meeting) => ({
        days: String(meeting.days || "").toUpperCase().split(""),
        startMinutes: minutes(meeting.start), endMinutes: minutes(meeting.end),
        location: meeting.location,
      })),
    }));
    const targets = new Map(schedule.courses.map(course => [course.codeSection,
      cards.find(card => card.id === `t${course.crn}`) ||
      cards.find(card => normalizeText(card.querySelector("header .heading")?.textContent).startsWith(`${course.codeSection} `)),
    ]));
    const signature = JSON.stringify(sections);
    if (signature === lastSignature && inserted.every(({ note, courseKey, card }) =>
      note.isConnected && note.parentElement === card && targets.get(courseKey) === card)) return;
    inserted.forEach(({ note }) => note.remove());
    // A page redraw may clone a course card along with its previously injected note.
    list.querySelectorAll(".ass-travel-notes--schedule").forEach(note => note.remove());
    inserted = [];
    lastSignature = signature;
    ensureStyles();
    const byCourse = new Map();
    for (const transfer of transfersFor(sections)) {
      const courseKey = transfer.to.section.courseKey;
      const card = targets.get(courseKey);
      if (!card) continue;
      if (!byCourse.has(courseKey)) {
        const note = document.createElement("div");
        note.className = "ass-travel-notes ass-travel-notes--schedule";
        note.setAttribute("aria-label", "Travel to this class");
        const header = card.querySelector("header");
        if (header) header.after(note); else card.prepend(note);
        byCourse.set(courseKey, note);
        inserted.push({ note, courseKey, card });
      }
      byCourse.get(courseKey).append(transferNote(transfer));
    }
  }
  Object.assign(api, { createTravelPanel, syncScheduleTravelReminders });
})();
