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
    const autoRatings = !!options?.autoRatings;
    const selections = options?.selections || null;
    const maxExplored = Number(options?.maxExplored) || 250000;
    const courseCount = sourceGroups.length;
    const ratingMaxTotal = courseCount * 5001;
    const knownAvailableWeight = ratingMaxTotal + 1;
    const openWeight = courseCount * knownAvailableWeight + ratingMaxTotal + 1;
    const prepared = [];

    for (const group of sourceGroups) {
      const requiredName = autoRatings ? null : selectedNameFor(selections, group.courseKey);
      if (!autoRatings && !requiredName) {
        return { ok: false, reason: "missing_instructor", courseKey: group.courseKey };
      }
      const candidates = [];
      for (const section of group.sections || []) {
        if (section.availability === "unavailable") {
          continue;
        }
        const instructor = bestInstructor(section, requiredName);
        if (!instructor) {
          continue;
        }
        const rating = ratingValue(instructor);
        const ratingScore = rating >= 0 ? Math.round(rating * 1000) + 1 : 0;
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
          _score: availabilityScore + ratingScore,
        });
      }
      if (!candidates.length) {
        return {
          ok: false,
          reason: "no_eligible_sections",
          courseKey: group.courseKey,
          instructor: requiredName,
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
      return "不可用（Open 0 / Waitlist 0）";
    }
    if (section.availability === "waitlist") {
      return `仅 Waitlist（Open 0 / Waitlist ${section.waitlistCount}）`;
    }
    if (section.availability === "open") {
      return `Open ${section.openSeats} / Waitlist ${section.waitlistCount ?? "?"}`;
    }
    return "名额状态未知";
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
      difficulty == null ? null : `难度 ${difficulty.toFixed(1)}/5`,
      wouldTake == null || wouldTake < 0 ? null : `${Math.round(wouldTake)}% 愿意再选`,
      reviews == null ? null : `${reviews} 条评价`,
    ].filter(Boolean).join("，");
  }

  function buildPrompt(groups, termName) {
    const lines = [
      "请根据下面的 UC Davis 课程数据，为我设计没有上课时间冲突的课表。",
      termName ? `学期：${termName}` : null,
      "硬性规则：每门课恰好选择一个 section；Open/Waitlist 都为 0 的 section 绝对不要选；如果只能选择 Waitlist，请醒目标注风险；同时说明 TBA 时间带来的不确定性。",
      "优化偏好：优先 Open section，其次优先 RateMyProfessors 评分更高、评价数更可靠的教授。请给出首选方案和至少一个可行备选（如有）。",
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
      lines.push("教授：");
      for (const instructor of instructors.values()) {
        lines.push(`- ${instructor.displayName} — ${formatRmp(instructor)}`);
      }
      lines.push("Sections：");
      for (const section of group.sections || []) {
        const meetings = section.meetings.length
          ? section.meetings.map(formatMeeting).join("；")
          : "TBA";
        lines.push(
          `- ${section.section || group.courseKey} | CRN ${section.crn || "N/A"} | ${formatAvailability(section)} | 教授 ${section.instructors.map((item) => item.displayName).join(" / ")} | ${meetings}${section.finalExam ? ` | Final: ${section.finalExam}` : ""}`,
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
    classifyAvailability,
    meetingsConflict,
    generateSchedule,
    formatMeeting,
    formatAvailability,
    formatRmp,
    buildPrompt,
  };
});
