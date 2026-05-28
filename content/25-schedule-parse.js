(() => {
  const { config, api } = window.ASS;

  const DAY_MAP = { M: "MO", T: "TU", W: "WE", R: "TH", F: "FR" };

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function expandDays(daysRaw) {
    const days = normalizeText(daysRaw).toUpperCase();
    if (!days) {
      return [];
    }
    const result = [];
    for (const char of days) {
      if (DAY_MAP[char]) {
        result.push(DAY_MAP[char]);
      }
    }
    return result;
  }

  function parseTimeRange(value) {
    const match = normalizeText(value).match(
      /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i,
    );
    if (!match) {
      return null;
    }
    return { start: match[1], end: match[2] };
  }

  function getCourseStatus(card, text) {
    if (/\bNot Registered\b/i.test(text)) {
      return "not_registered";
    }
    if (/Registration Status:\s*Registered/i.test(text)) {
      return "registered";
    }

    for (const badge of card.querySelectorAll(".statusIndicator, .statusIndicator2")) {
      const badgeText = normalizeText(badge.textContent);
      const className = typeof badge.className === "string" ? badge.className : "";
      if (/\bnot registered\b/i.test(badgeText) || /\bnonregistered\b/i.test(className)) {
        return "not_registered";
      }
      if (/\bregistered\b/i.test(badgeText) || /\bregistered\b/i.test(className)) {
        return "registered";
      }
      if (/waitlist/i.test(badgeText) || /waitlist/i.test(className)) {
        return "waitlisted";
      }
    }

    if (/waitlist/i.test(text)) {
      return "waitlisted";
    }
    return "not_registered";
  }

  function parseCourseHeader(text) {
    const match = normalizeText(text).match(
      /^([A-Z]{2,4}\s+\d{3}[A-Z]?\s+\S+)\s+(.+?)\s+(?:Registered|Not Registered|Open\/Waitlisted)/i,
    );
    if (!match) {
      return { codeSection: null, title: null };
    }
    return {
      codeSection: match[1].trim(),
      title: match[2].trim(),
    };
  }

  function parseMeetingsFromCard(card) {
    const meetings = [];
    let skippedAsync = false;

    for (const table of card.querySelectorAll("table.table-sm")) {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")].map((td) =>
          normalizeText(td.textContent),
        );
        if (cells.length < 4) {
          continue;
        }
        const [type, timeRaw, daysRaw, location] = cells;
        const time = parseTimeRange(timeRaw);
        const days = expandDays(daysRaw);
        if (!time || !days.length) {
          if (type && !time && !daysRaw) {
            skippedAsync = true;
          }
          continue;
        }
        meetings.push({
          type,
          days: daysRaw,
          dayCodes: days,
          start: time.start,
          end: time.end,
          location: location || "TBA",
        });
      }
    }

    return { meetings, skippedAsync };
  }

  function parseFinalExamValue(value) {
    const normalized = normalizeText(value);
    if (!normalized || /^(none|n\/a|tbd|no final exam)/i.test(normalized)) {
      return null;
    }
    const dateMatch = normalized.match(
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)/i,
    );
    if (!dateMatch) {
      return { raw: normalized };
    }
    return { raw: normalized, date: dateMatch[1], time: dateMatch[2] };
  }

  function parseFinalExamFromCard(card) {
    for (const dt of card.querySelectorAll("dt.boldTitle, dt")) {
      const label = normalizeText(dt.textContent);
      if (!/^Final Exam:?$/i.test(label)) {
        continue;
      }
      const sibling = dt.nextElementSibling;
      const fromSibling = parseFinalExamValue(sibling?.textContent);
      if (fromSibling) {
        return fromSibling;
      }
    }

    // textContent includes collapsed "Important Course Details" (innerText does not).
    const text = card.textContent || "";
    const match = text.match(/Final Exam:\s*([^\n]+)/i);
    if (match) {
      return parseFinalExamValue(match[1]);
    }

    return null;
  }

  function parseNotesFromCard(card) {
    const text = card.textContent || "";
    const descriptionMatch = text.match(/Description:\s*([^\n]+(?:\n[^\n]+)*?)(?=\n[A-Z][a-z]+:|$)/i);
    const courseNotesMatch = text.match(/Course Notes:\s*([^\n]+)/i);
    const parts = [];
    if (courseNotesMatch) {
      parts.push(courseNotesMatch[1].trim());
    }
    if (descriptionMatch) {
      parts.push(descriptionMatch[1].replace(/\s+/g, " ").trim().slice(0, 500));
    }
    return parts.join("\n\n");
  }

  function readTermName() {
    const fromSelect = document.querySelector("#termCode1 option:checked")?.textContent;
    if (fromSelect?.trim()) {
      return normalizeText(fromSelect);
    }
    const fromBody = document.body.innerText.match(
      /(Fall|Winter|Spring|Summer)[^\n]{0,40}20\d{2}/i,
    );
    return fromBody ? normalizeText(fromBody[0]) : null;
  }

  function readScheduleName() {
    const fromSelect = document.querySelector("#scheduleList option:checked")?.textContent;
    if (fromSelect?.trim()) {
      return normalizeText(fromSelect);
    }
    const fromText = document.body.innerText.match(/Current Schedule:\s*([^\n]+)/i);
    return fromText ? normalizeText(fromText[1]) : "Schedule 1";
  }

  function parseScheduleFromDom() {
    const termName = readTermName();
    const scheduleName = readScheduleName();
    const selector =
      config.scheduleCourseSelector ||
      "#SavedSchedulesListDisplayContainer article.CourseItem";
    const cards = document.querySelectorAll(selector);
    const courses = [];

    if (!cards.length) {
      return {
        ok: false,
        termName,
        scheduleName,
        courses: [],
        error: "No schedule found on this page.",
      };
    }

    for (const card of cards) {
      const fullText = normalizeText(card.textContent);
      const status = getCourseStatus(card, fullText);
      if (status !== "registered" && status !== "waitlisted") {
        continue;
      }

      const header = parseCourseHeader(fullText);
      if (!header.codeSection) {
        continue;
      }

      const { meetings, skippedAsync } = parseMeetingsFromCard(card);
      const crnMatch = fullText.match(/CRN:\s*(\d+)/i);
      const unitsMatch = fullText.match(/Units:\s*([\d.]+)/i);
      const finalExam = parseFinalExamFromCard(card);

      courses.push({
        codeSection: header.codeSection,
        title: header.title,
        status,
        crn: crnMatch?.[1] || null,
        units: unitsMatch?.[1] || null,
        notes: parseNotesFromCard(card),
        meetings,
        skippedAsync,
        finalExam,
      });
    }

    return {
      ok: courses.length > 0,
      termName,
      scheduleName,
      courses,
      error: courses.length ? null : "No registered or waitlisted courses to export.",
    };
  }

  function formatEventTitle(course) {
    const waitTag = course.status === "waitlisted" ? " [W]" : "";
    return `${course.codeSection}${waitTag}: ${course.title}`;
  }

  Object.assign(api, {
    parseScheduleFromDom,
    formatCalendarEventTitle: formatEventTitle,
    expandMtwrfDays: expandDays,
  });
})();
