/**
 * Pure helpers for course normalization, conflict detection, schedule search,
 * and GPT prompt generation. Shared by the content script and Node tests.
 */
(function (root, factory) {
  const api = factory();
  root.ASS_SCHEDULER_CORE = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  const DAY_KEYS = [
    ["sunday", "U"],
    ["monday", "M"],
    ["tuesday", "T"],
    ["wednesday", "W"],
    ["thursday", "R"],
    ["friday", "F"],
    ["saturday", "S"],
  ];
  const WEEKDAY_OPTIONS = [
    { key: "M", label: "Monday" },
    { key: "T", label: "Tuesday" },
    { key: "W", label: "Wednesday" },
    { key: "R", label: "Thursday" },
    { key: "F", label: "Friday" },
  ];
  const TIME_BLOCKS = [
    { key: "earlyMorning", label: "Early morning", rangeLabel: "Before 9:00 AM", startMinutes: 0, endMinutes: 540 },
    { key: "morning", label: "Morning", rangeLabel: "9:00 AM–12:00 PM", startMinutes: 540, endMinutes: 720 },
    { key: "afternoon", label: "Afternoon", rangeLabel: "12:00–5:00 PM", startMinutes: 720, endMinutes: 1020 },
    { key: "evening", label: "Evening", rangeLabel: "After 5:00 PM", startMinutes: 1020, endMinutes: 1440 },
  ];
  const TIME_PREFERENCE_LEVELS = ["preferred", "neutral", "avoid", "never"];

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeCourseCode(subject, number) {
    const subjectCode = normalizeText(subject).toUpperCase();
    const match = normalizeText(number).toUpperCase().match(/^0*(\d{1,3})([A-Z]{0,2})$/);
    if (!subjectCode || !match) {
      return null;
    }
    return `${subjectCode} ${match[1].padStart(3, "0")}${match[2]}`;
  }

  function parseCourseCodes(input) {
    const source = String(input || "").toUpperCase();
    const codes = [];
    const seen = new Set();
    const pattern = /\b([A-Z]{2,4})[\s-]*0*(\d{1,3})([A-Z]{0,2})\b/g;
    let match;
    while ((match = pattern.exec(source))) {
      const code = normalizeCourseCode(match[1], `${match[2]}${match[3]}`);
      if (code && !seen.has(code)) {
        seen.add(code);
        codes.push(code);
      }
    }
    return codes;
  }

  function numberOrNull(value) {
    if (value === "" || value == null) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function timeToMinutes(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length < 3 || digits.length > 4) {
      return null;
    }
    const padded = digits.padStart(4, "0");
    const hours = Number(padded.slice(0, 2));
    const minutes = Number(padded.slice(2));
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function meetingDays(raw) {
    const explicit = DAY_KEYS.filter(([key]) => raw?.[key] === true).map(([, day]) => day);
    if (explicit.length) {
      return explicit;
    }
    const value = normalizeText(raw?.daysString).toUpperCase();
    if (!value || value === "TBA") {
      return [];
    }
    const days = [];
    for (const char of value.replace(/TH/g, "R")) {
      if ("UMTWRFS".includes(char) && !days.includes(char)) {
        days.push(char);
      }
    }
    return days;
  }

  function normalizeMeeting(raw) {
    const days = meetingDays(raw || {});
    const startMinutes = timeToMinutes(raw?.startTime);
    const endMinutes = timeToMinutes(raw?.endTime);
    return {
      type: normalizeText(raw?.description || raw?.type || raw?.meetCode) || "Meeting",
      days,
      startMinutes,
      endMinutes,
      startTime: normalizeText(raw?.startTime),
      endTime: normalizeText(raw?.endTime),
      location: normalizeText(`${raw?.building || ""} ${raw?.room || ""}`) || "TBA",
      isTba: !days.length || startMinutes == null || endMinutes == null,
    };
  }

  function normalizeInstructor(raw) {
    const displayName = normalizeText(
      raw?.instructorName || `${raw?.firstName || ""} ${raw?.lastName || ""}`,
    );
    return {
      displayName: displayName || "TBA",
      firstName: normalizeText(raw?.firstName),
      lastName: normalizeText(raw?.lastName),
      email: normalizeText(raw?.instructorEmail),
      rmp: raw?.rmp || null,
    };
  }

  function classifyAvailability(openSeats, waitlistCount) {
    if (openSeats === 0 && waitlistCount === 0) {
      return "unavailable";
    }
    if (openSeats != null && openSeats > 0) {
      return "open";
    }
    if (openSeats === 0 && waitlistCount != null && waitlistCount > 0) {
      return "waitlist";
    }
    return "unknown";
  }

  function normalizeSearchResult(raw) {
    const course = raw?.course || {};
    const courseKey = normalizeCourseCode(course.subjectCode, course.courseNum);
    const openSeats = numberOrNull(raw?.seats?.seatsAvail ?? course.seatsAvail);
    const waitlistCount = numberOrNull(raw?.seats?.waitCount ?? course.waitCount);
    const instructors = (Array.isArray(raw?.instructor) ? raw.instructor : [])
      .map(normalizeInstructor);
    if (!instructors.length) {
      instructors.push(normalizeInstructor(null));
    }
    return {
      courseKey,
      section: normalizeText(course.shortDesc),
      sectionCode: normalizeText(course.seqNum),
      crn: normalizeText(course.printCRN || course.crn),
      saveKey: normalizeText(
        course.printCRN && course.printCRN !== "@"
          ? course.printCRN
          : course.hidCRN || course.crn || course.printCRN,
      ),
      title: normalizeText(course.title),
      units: numberOrNull(course.unitsLow),
      instructors,
      meetings: (Array.isArray(raw?.meeting) ? raw.meeting : []).map(normalizeMeeting),
      finalExam: normalizeText(raw?.finalExam?.examDate),
      openSeats,
      waitlistCount,
      availability: classifyAvailability(openSeats, waitlistCount),
      seatError: normalizeText(raw?.seatError),
      existingScheduleConflict: raw?.existingScheduleConflict === true,
      existingScheduleConflictText: normalizeText(raw?.existingScheduleConflictText),
    };
  }

  function meetingsConflict(first, second) {
    for (const a of first || []) {
      if (a.isTba || a.startMinutes == null || a.endMinutes == null) {
        continue;
      }
      for (const b of second || []) {
        if (b.isTba || b.startMinutes == null || b.endMinutes == null) {
          continue;
        }
        if (!a.days.some((day) => b.days.includes(day))) {
          continue;
        }
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          return true;
        }
      }
    }
    return false;
  }

  function ratingValue(instructor) {
    const value = numberOrNull(instructor?.rmp?.rating);
    return value == null ? -1 : value;
  }

  function bestInstructor(section, requiredName) {
    if (requiredName) {
      return section.instructors.find((item) => item.displayName === requiredName) || null;
    }
    return [...section.instructors].sort((a, b) => ratingValue(b) - ratingValue(a))[0] || null;
  }

  function selectedNameFor(selections, courseKey) {
    if (!selections) {
      return null;
    }
    if (typeof selections.get === "function") {
      return selections.get(courseKey) || null;
    }
    return selections[courseKey] || null;
  }

  function normalizeSchedulerPreferences(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const preferredDays = [...new Set(
      (Array.isArray(source.preferredDays) ? source.preferredDays : [])
        .map((day) => String(day || "").toUpperCase())
        .filter((day) => WEEKDAY_OPTIONS.some((option) => option.key === day)),
    )];
    const timeBlocks = {};
    for (const block of TIME_BLOCKS) {
      const level = String(source.timeBlocks?.[block.key] || "neutral").toLowerCase();
      timeBlocks[block.key] = TIME_PREFERENCE_LEVELS.includes(level)
        ? level
        : "neutral";
    }
    return { preferredDays, timeBlocks };
  }

  function overlapMinutes(startA, endA, startB, endB) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  }

  function timePreferenceScore(section, rawPreferences) {
    const preferences = normalizeSchedulerPreferences(rawPreferences);
    const preferredDays = new Set(preferences.preferredDays);
    const usesDayPreferences = preferredDays.size > 0;
    const levelQuality = {
      preferred: 1,
      neutral: 0.5,
      avoid: 0,
    };
    let scheduledMinutes = 0;
    let preferredDayMinutes = 0;
    let weightedTimeMinutes = 0;

    for (const meeting of section?.meetings || []) {
      if (
        meeting?.isTba ||
        meeting?.startMinutes == null ||
        meeting?.endMinutes == null ||
        meeting.endMinutes <= meeting.startMinutes
      ) {
        continue;
      }
      const days = Array.isArray(meeting.days) ? meeting.days : [];
      for (const day of days) {
        const duration = meeting.endMinutes - meeting.startMinutes;
        scheduledMinutes += duration;
        if (preferredDays.has(day)) {
          preferredDayMinutes += duration;
        }
        for (const block of TIME_BLOCKS) {
          const overlap = overlapMinutes(
            meeting.startMinutes,
            meeting.endMinutes,
            block.startMinutes,
            block.endMinutes,
          );
          if (!overlap) {
            continue;
          }
          const level = preferences.timeBlocks[block.key];
          if (level === "never") {
            return {
              hardBlocked: true,
              quality: 0,
              dayQuality: usesDayPreferences ? 0 : 0.5,
              timeQuality: 0,
            };
          }
          weightedTimeMinutes += overlap * levelQuality[level];
        }
      }
    }

    if (!scheduledMinutes) {
      return { hardBlocked: false, quality: 0.5, dayQuality: 0.5, timeQuality: 0.5 };
    }
    const dayQuality = usesDayPreferences
      ? preferredDayMinutes / scheduledMinutes
      : 0.5;
    const timeQuality = weightedTimeMinutes / scheduledMinutes;
    return {
      hardBlocked: false,
      quality: usesDayPreferences
        ? dayQuality * 0.35 + timeQuality * 0.65
        : timeQuality,
      dayQuality,
      timeQuality,
    };
  }

  function compareCandidate(a, b) {
    if (a._score !== b._score) {
      return b._score - a._score;
    }
    return String(a.section).localeCompare(String(b.section), undefined, {
      numeric: true,
    });
  }

  function generateSchedule(groups, options) {
    const sourceGroups = Array.isArray(groups) ? groups : [];
    const priority = options?.priority || (options?.autoRatings ? "rating" : "manual");
    const autoSelectInstructor = priority === "rating" || priority === "time";
    const selections = options?.selections || null;
    const preferences = normalizeSchedulerPreferences(options?.preferences);
    const requestedMaxExplored = Number(options?.maxExplored);
    const maxExplored = Number.isInteger(requestedMaxExplored) && requestedMaxExplored > 0
      ? requestedMaxExplored
      : 250000;
    const courseCount = sourceGroups.length;
    const qualityMaxPerCourse = 10100;
    const qualityMaxTotal = courseCount * qualityMaxPerCourse;
    const knownAvailableWeight = qualityMaxTotal + 1;
    const openWeight = courseCount * knownAvailableWeight + qualityMaxTotal + 1;
    const prepared = [];

    for (const group of sourceGroups) {
      const requiredName = autoSelectInstructor
        ? null
        : selectedNameFor(selections, group.courseKey);
      if (!autoSelectInstructor && !requiredName) {
        return { ok: false, reason: "missing_instructor", courseKey: group.courseKey };
      }
      const candidates = [];
      let blockedByTimePreferences = false;
      for (const section of group.sections || []) {
        if (section.availability === "unavailable" || section.existingScheduleConflict) {
          continue;
        }
        const instructor = bestInstructor(section, requiredName);
        if (!instructor) {
          continue;
        }
        const timeScore = timePreferenceScore(section, preferences);
        if (timeScore.hardBlocked) {
          blockedByTimePreferences = true;
          continue;
        }
        const rating = ratingValue(instructor);
        const ratingQuality = rating >= 0 ? Math.min(1, Math.max(0, rating / 5)) : 0;
        const ratingFirst = priority === "rating";
        const qualityScore = Math.round(
          (ratingFirst ? ratingQuality : timeScore.quality) * 10000 +
          (ratingFirst ? timeScore.quality : ratingQuality) * 100,
        );
        const availabilityScore =
          section.availability === "open"
            ? openWeight
            : section.availability === "waitlist"
              ? knownAvailableWeight
              : 0;
        candidates.push({
          ...section,
          selectedInstructor: instructor,
          selectedRating: rating >= 0 ? rating : null,
          timePreferenceQuality: timeScore.quality,
          _score: availabilityScore + qualityScore,
        });
      }
      if (!candidates.length) {
        return {
          ok: false,
          reason: "no_eligible_sections",
          courseKey: group.courseKey,
          instructor: requiredName,
          blockedByTimePreferences,
        };
      }
      candidates.sort(compareCandidate);
      prepared.push({ courseKey: group.courseKey, candidates });
    }

    prepared.sort((a, b) => a.candidates.length - b.candidates.length);
    const suffixMax = new Array(prepared.length + 1).fill(0);
    for (let index = prepared.length - 1; index >= 0; index -= 1) {
      suffixMax[index] = suffixMax[index + 1] + prepared[index].candidates[0]._score;
    }

    let explored = 0;
    let bestScore = -1;
    let best = null;
    let truncated = false;
    let foundUpperBound = false;

    function visit(index, chosen, score) {
      if (foundUpperBound || truncated) {
        return;
      }
      if (explored >= maxExplored) {
        truncated = true;
        return;
      }
      if (best && score + suffixMax[index] <= bestScore) {
        return;
      }
      if (index >= prepared.length) {
        explored += 1;
        if (score > bestScore) {
          bestScore = score;
          best = [...chosen];
          foundUpperBound = score === suffixMax[0];
        }
        return;
      }

      for (const candidate of prepared[index].candidates) {
        explored += 1;
        if (explored >= maxExplored) {
          truncated = true;
          return;
        }
        if (chosen.some((item) => meetingsConflict(item.meetings, candidate.meetings))) {
          continue;
        }
        chosen.push(candidate);
        visit(index + 1, chosen, score + candidate._score);
        chosen.pop();
        if (foundUpperBound || truncated) {
          return;
        }
      }
    }

    visit(0, [], 0);
    if (!best) {
      return { ok: false, reason: "no_conflict_free_schedule", explored, truncated };
    }
    const schedule = best.sort((a, b) =>
      String(a.courseKey).localeCompare(String(b.courseKey), undefined, { numeric: true }),
    );
    return {
      ok: true,
      schedule,
      explored,
      truncated,
      optimal: foundUpperBound && !truncated,
      priority,
      hasWaitlist: schedule.some((item) => item.availability === "waitlist"),
      hasUnknownSeats: schedule.some((item) => item.availability === "unknown"),
      hasTbaMeetings: schedule.some((item) => item.meetings.some((meeting) => meeting.isTba)),
    };
  }

  function formatClock(minutes, fallback) {
    if (minutes == null) {
      return fallback || "TBA";
    }
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function formatMeeting(meeting) {
    if (!meeting || meeting.isTba) {
      return `${meeting?.type || "Meeting"}: TBA`;
    }
    return `${meeting.type}: ${meeting.days.join("")} ${formatClock(meeting.startMinutes)}-${formatClock(meeting.endMinutes)} @ ${meeting.location}`;
  }

  function formatAvailability(section) {
    if (section.availability === "unavailable") {
      return "Unavailable (Open 0 / Waitlist 0)";
    }
    if (section.availability === "waitlist") {
      return `Waitlist only (Open 0 / Waitlist ${section.waitlistCount})`;
    }
    if (section.availability === "open") {
      return `Open ${section.openSeats} / Waitlist ${section.waitlistCount ?? "?"}`;
    }
    return "Seat status unknown";
  }

  function formatRmp(instructor) {
    const rating = numberOrNull(instructor?.rmp?.rating);
    if (rating == null) {
      return "RMP: N/A";
    }
    const difficulty = numberOrNull(instructor.rmp.difficulty);
    const wouldTake = numberOrNull(instructor.rmp.wouldTakeAgainPercent);
    const reviews = numberOrNull(instructor.rmp.reviewCount);
    return [
      `RMP ${rating.toFixed(1)}/5`,
      difficulty == null ? null : `difficulty ${difficulty.toFixed(1)}/5`,
      wouldTake == null || wouldTake < 0 ? null : `${Math.round(wouldTake)}% would take again`,
      reviews == null ? null : `${reviews} reviews`,
    ].filter(Boolean).join(", ");
  }

  function formatSchedulerPreferences(rawPreferences) {
    const preferences = normalizeSchedulerPreferences(rawPreferences);
    const preferredDayLabels = preferences.preferredDays.map(
      (day) => WEEKDAY_OPTIONS.find((option) => option.key === day)?.label || day,
    );
    const levels = { preferred: [], avoid: [], never: [] };
    for (const block of TIME_BLOCKS) {
      const level = preferences.timeBlocks[block.key];
      if (levels[level]) {
        levels[level].push(`${block.label} (${block.rangeLabel})`);
      }
    }
    return [
      `Preferred weekdays: ${preferredDayLabels.length ? preferredDayLabels.join(", ") : "No weekday preference"}.`,
      `Preferred time blocks: ${levels.preferred.length ? levels.preferred.join(", ") : "None"}.`,
      `Less-preferred time blocks: ${levels.avoid.length ? levels.avoid.join(", ") : "None"}.`,
      `Never schedule in: ${levels.never.length ? levels.never.join(", ") : "None"}.`,
    ];
  }

  function buildPrompt(groups, termName, rawPreferences) {
    const lines = [
      "Using the UC Davis course data below, design a schedule with no class-time conflicts.",
      termName ? `Term: ${termName}` : null,
      "Hard constraints: choose exactly one section for every course; never select a section with Open 0 and Waitlist 0; never select a section marked as conflicting with my current Schedule Builder schedule; treat every time block listed under Never schedule in as a hard exclusion; clearly flag any waitlist-only choice; explain any uncertainty caused by TBA meetings.",
      "Optimization preferences: prioritize open sections, then professors with stronger RateMyProfessors ratings and more reliable review counts. Provide a preferred schedule and at least one feasible alternative when possible.",
      ...formatSchedulerPreferences(rawPreferences),
      "",
    ].filter((line) => line != null);

    for (const group of groups || []) {
      lines.push(`## ${group.courseKey}${group.title ? ` — ${group.title}` : ""}`);
      const instructors = new Map();
      for (const section of group.sections || []) {
        for (const instructor of section.instructors || []) {
          if (!instructors.has(instructor.displayName)) {
            instructors.set(instructor.displayName, instructor);
          }
        }
      }
      lines.push("Professors:");
      for (const instructor of instructors.values()) {
        lines.push(`- ${instructor.displayName} — ${formatRmp(instructor)}`);
      }
      lines.push("Sections:");
      for (const section of group.sections || []) {
        const meetings = section.meetings.length
          ? section.meetings.map(formatMeeting).join("; ")
          : "TBA";
        const existingConflict = section.existingScheduleConflict
          ? ` | CONFLICTS WITH CURRENT SCHEDULE${section.existingScheduleConflictText ? `: ${section.existingScheduleConflictText}` : ""}`
          : "";
        lines.push(
          `- ${section.section || group.courseKey} | CRN ${section.crn || "N/A"} | ${formatAvailability(section)} | Professor ${section.instructors.map((item) => item.displayName).join(" / ")} | ${meetings}${section.finalExam ? ` | Final: ${section.finalExam}` : ""}${existingConflict}`,
        );
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  return {
    normalizeCourseCode,
    parseCourseCodes,
    normalizeSearchResult,
    normalizeSchedulerPreferences,
    timePreferenceScore,
    classifyAvailability,
    meetingsConflict,
    generateSchedule,
    formatMeeting,
    formatAvailability,
    formatRmp,
    buildPrompt,
    WEEKDAY_OPTIONS,
    TIME_BLOCKS,
    TIME_PREFERENCE_LEVELS,
  };
});
