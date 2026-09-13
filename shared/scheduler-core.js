/**
 * Pure helpers for course normalization, conflict detection, and schedule
 * search. Shared by the content script and Node tests.
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

  const PREFERENCE_STOPS = 5;
  const NEUTRAL_PREFERENCE = 2;
  const NEUTRAL_QUALITY = 0.5;
  // Time-of-day matters a little more than which weekday a class lands on.
  const DAY_SHARE = 0.4;
  const QUALITY_STEPS = 1000;
  // What a section makes you give up, cheapest first. Nothing is ever excluded
  // outright: any cost at all outranks every quality difference, so a
  // compromised option can never beat a clean one, but it still gets shown
  // when there is nothing better.
  const LIMIT_COST = {
    unknownSeats: 1,
    waitlist: 3,
    overlap: 9,
    existingConflict: 9,
    closed: 12,
  };
  const MAX_SECTION_COST = LIMIT_COST.closed + LIMIT_COST.existingConflict;

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
      crn: normalizeText(course.printCRN || course.crn),
      saveKey: normalizeText(
        course.printCRN && course.printCRN !== "@"
          ? course.printCRN
          : course.hidCRN || course.crn || course.printCRN,
      ),
      title: normalizeText(course.title),
      instructors,
      meetings: (Array.isArray(raw?.meeting) ? raw.meeting : []).map(normalizeMeeting),
      openSeats,
      waitlistCount,
      availability: classifyAvailability(openSeats, waitlistCount),
      existingScheduleConflict: raw?.existingScheduleConflict === true,
    };
  }

  function sectionKey(section) {
    return section?.saveKey || section?.crn || "";
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

  function bestRatedInstructor(section) {
    return [...section.instructors].sort((a, b) => ratingValue(b) - ratingValue(a))[0] || null;
  }

  /**
   * Every preference is a slider position from 0 ("not ideal") to
   * `PREFERENCE_STOPS - 1` ("perfect"), defaulting to the middle stop. Nothing
   * is a hard exclusion; a low score only sinks an option down the ranking.
   */
  function preferenceLevel(value) {
    const level = Math.round(Number(value));
    return level >= 0 && level < PREFERENCE_STOPS ? level : NEUTRAL_PREFERENCE;
  }

  function normalizeSchedulerPreferences(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const timeBlocks = {};
    for (const block of TIME_BLOCKS) {
      timeBlocks[block.key] = preferenceLevel(source.timeBlocks?.[block.key]);
    }
    const days = {};
    for (const option of WEEKDAY_OPTIONS) {
      days[option.key] = preferenceLevel(source.days?.[option.key]);
    }
    return { timeBlocks, days };
  }

  function levelQuality(level) {
    return preferenceLevel(level) / (PREFERENCE_STOPS - 1);
  }

  function overlapMinutes(startA, endA, startB, endB) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  }

  /** How much of a meeting falls inside time blocks the student likes. */
  function meetingTimeQuality(meeting, timeBlocks) {
    let covered = 0;
    let weighted = 0;
    for (const block of TIME_BLOCKS) {
      const overlap = overlapMinutes(
        meeting.startMinutes,
        meeting.endMinutes,
        block.startMinutes,
        block.endMinutes,
      );
      covered += overlap;
      weighted += overlap * levelQuality(timeBlocks[block.key]);
    }
    return covered ? weighted / covered : NEUTRAL_QUALITY;
  }

  /** 0..1 score for how well a section matches the time and day sliders. */
  function preferenceQuality(section, preferences) {
    let scheduledMinutes = 0;
    let weighted = 0;
    for (const meeting of section?.meetings || []) {
      const duration = meeting?.isTba ? 0 : meeting.endMinutes - meeting.startMinutes;
      if (!(duration > 0)) {
        continue;
      }
      const timeQuality = meetingTimeQuality(meeting, preferences.timeBlocks);
      for (const day of meeting.days || []) {
        const dayQuality = levelQuality(preferences.days[day]);
        scheduledMinutes += duration;
        weighted += duration * (timeQuality * (1 - DAY_SHARE) + dayQuality * DAY_SHARE);
      }
    }
    return scheduledMinutes ? weighted / scheduledMinutes : NEUTRAL_QUALITY;
  }

  function compareCandidate(a, b) {
    if (a._score !== b._score) {
      return b._score - a._score;
    }
    return String(a.section).localeCompare(String(b.section), undefined, { numeric: true });
  }

  function clamp01(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : NEUTRAL_QUALITY;
  }

  function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  function sectionLimits(section, includeWaitlist) {
    const limits = [];
    if (section.availability === "waitlist" && !includeWaitlist) {
      limits.push("waitlist");
    } else if (section.availability === "unavailable") {
      limits.push("closed");
    } else if (section.availability === "unknown") {
      limits.push("unknownSeats");
    }
    if (section.existingScheduleConflict) {
      limits.push("existingConflict");
    }
    return limits;
  }

  function summarizeOption(sections) {
    const ordered = [...sections].sort((a, b) =>
      String(a.courseKey).localeCompare(String(b.courseKey), undefined, { numeric: true }),
    );
    const overlaps = [];
    const limits = new Set();
    for (let first = 0; first < ordered.length; first += 1) {
      for (const kind of ordered[first].limits) {
        limits.add(kind);
      }
      for (let second = first + 1; second < ordered.length; second += 1) {
        if (meetingsConflict(ordered[first].meetings, ordered[second].meetings)) {
          overlaps.push([ordered[first].section, ordered[second].section]);
          limits.add("overlap");
        }
      }
    }
    const rated = ordered.filter((section) => section.selectedRating != null);
    return {
      sections: ordered,
      overlaps,
      limits: [...limits],
      timeMatch: ordered.reduce((sum, section) => sum + section.timeQuality, 0) / ordered.length,
      averageRating: rated.length
        ? rated.reduce((sum, section) => sum + section.selectedRating, 0) / rated.length
        : null,
      hasWaitlist: ordered.some((section) => section.availability === "waitlist"),
      hasTbaMeetings: ordered.some((section) => section.meetings.some((meeting) => meeting.isTba)),
    };
  }

  /**
   * Branch and bound over one section per course, keeping the best `maxOptions`
   * combinations. Overlapping classes are rejected outright on the first pass
   * and merely penalized on the retry, so an impossible timetable still
   * produces something to look at.
   */
  function searchCombinations(prepared, settings) {
    const { allowOverlaps, overlapPenalty, maxOptions, maxExplored } = settings;
    const suffixMax = new Array(prepared.length + 1).fill(0);
    for (let index = prepared.length - 1; index >= 0; index -= 1) {
      suffixMax[index] = suffixMax[index + 1] + prepared[index][0]._score;
    }

    const best = [];
    let explored = 0;
    let truncated = false;

    function visit(index, chosen, score) {
      const worstKept = best.length === maxOptions ? best[best.length - 1].score : -Infinity;
      if (truncated || score + suffixMax[index] <= worstKept) {
        return;
      }
      if (index >= prepared.length) {
        const position = best.findIndex((entry) => entry.score < score);
        best.splice(position < 0 ? best.length : position, 0, {
          sections: [...chosen],
          score,
        });
        if (best.length > maxOptions) {
          best.pop();
        }
        return;
      }
      for (const candidate of prepared[index]) {
        explored += 1;
        if (explored >= maxExplored) {
          truncated = true;
          return;
        }
        const overlaps = chosen.filter((item) =>
          meetingsConflict(item.meetings, candidate.meetings),
        ).length;
        if (overlaps && !allowOverlaps) {
          continue;
        }
        chosen.push(candidate);
        visit(index + 1, chosen, score + candidate._score - overlaps * overlapPenalty);
        chosen.pop();
        if (truncated) {
          return;
        }
      }
    }

    visit(0, [], 0);
    return { best, truncated };
  }

  /**
   * Ranks combinations of one section per course and returns the best few.
   * Sections that cost you something (waitlist, closed, clashing with courses
   * you already saved) sort below clean ones but are still returned, and each
   * option reports the limits it ran into. `ratingWeight` blends the preference
   * sliders with RateMyProfessors ratings (0 = times only, 1 = ratings only).
   */
  function generateSchedules(groups, options) {
    const sourceGroups = Array.isArray(groups) ? groups : [];
    const preferences = normalizeSchedulerPreferences(options?.preferences);
    const ratingWeight = clamp01(options?.ratingWeight);
    const includeWaitlist = options?.includeWaitlist === true;
    const maxOptions = positiveInteger(options?.maxOptions, 8);
    const maxExplored = positiveInteger(options?.maxExplored, 250000);
    // One unit of compromise must outweigh every possible quality difference.
    const compromiseWeight = sourceGroups.length * QUALITY_STEPS + 1;
    const prepared = [];

    for (const group of sourceGroups) {
      const candidates = [];
      // A kept section narrows its course to that one choice, unless it has
      // gone stale since the search that produced it.
      const keptKey = options?.pinned?.get(group.courseKey);
      const sections = group.sections || [];
      const kept = keptKey ? sections.filter((item) => sectionKey(item) === keptKey) : [];
      for (const section of kept.length ? kept : sections) {
        const instructor = bestRatedInstructor(section);
        if (!instructor) {
          continue;
        }
        const rating = ratingValue(instructor);
        const timeQuality = preferenceQuality(section, preferences);
        const ratingQuality = rating >= 0 ? rating / 5 : NEUTRAL_QUALITY;
        const quality = timeQuality * (1 - ratingWeight) + ratingQuality * ratingWeight;
        const limits = sectionLimits(section, includeWaitlist);
        const cost = limits.reduce((sum, kind) => sum + LIMIT_COST[kind], 0);
        candidates.push({
          ...section,
          selectedInstructor: instructor,
          selectedRating: rating >= 0 ? rating : null,
          timeQuality,
          limits,
          _score:
            (MAX_SECTION_COST - cost) * compromiseWeight +
            Math.round(quality * QUALITY_STEPS),
        });
      }
      if (!candidates.length) {
        return { ok: false, reason: "no_sections", courseKey: group.courseKey };
      }
      candidates.sort(compareCandidate);
      prepared.push(candidates);
    }

    // Courses with the fewest sections first, so the bound bites early.
    prepared.sort((a, b) => a.length - b.length);
    const settings = {
      allowOverlaps: false,
      overlapPenalty: LIMIT_COST.overlap * compromiseWeight,
      maxOptions,
      maxExplored,
    };
    let { best, truncated } = searchCombinations(prepared, settings);
    if (!best.length && !truncated) {
      ({ best, truncated } = searchCombinations(prepared, { ...settings, allowOverlaps: true }));
    }
    if (!best.length) {
      return { ok: false, reason: "search_exhausted", truncated };
    }
    return {
      ok: true,
      truncated,
      options: best.map((entry) => summarizeOption(entry.sections)),
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
      return "TBA";
    }
    const days = meeting.days.join("");
    const time = `${formatClock(meeting.startMinutes)}-${formatClock(meeting.endMinutes)}`;
    return `${days} ${time} · ${meeting.location}`;
  }

  /** Seat status as a short badge label plus a tone shared with the RMP cards. */
  function seatSummary(section) {
    if (section.availability === "open") {
      return {
        label: String(section.openSeats ?? "?"),
        tone: section.openSeats >= 5 ? "good" : "mid",
      };
    }
    if (section.availability === "waitlist") {
      return { label: `WL ${section.waitlistCount}`, tone: "mid" };
    }
    return section.availability === "unavailable"
      ? { label: "Full", tone: "low" }
      : { label: "?", tone: "neutral" };
  }

  return {
    normalizeCourseCode,
    parseCourseCodes,
    normalizeSearchResult,
    normalizeSchedulerPreferences,
    classifyAvailability,
    meetingsConflict,
    generateSchedules,
    sectionKey,
    formatMeeting,
    seatSummary,
    WEEKDAY_OPTIONS,
    TIME_BLOCKS,
    PREFERENCE_STOPS,
  };
});
