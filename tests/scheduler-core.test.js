const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../shared/scheduler-core.js");

function section({
  courseKey,
  section: sectionName,
  instructor,
  rating,
  days,
  start,
  end,
  availability = "open",
  existingScheduleConflict = false,
}) {
  return {
    courseKey,
    section: `${courseKey} ${sectionName}`,
    crn: `${courseKey}-${sectionName}`,
    saveKey: `${courseKey}-${sectionName}`,
    instructors: [
      {
        displayName: instructor,
        rmp: rating == null ? null : { rating, reviewCount: 10 },
      },
    ],
    meetings: [
      {
        type: "Lecture",
        days,
        startMinutes: start,
        endMinutes: end,
        isTba: false,
        location: "Test Hall",
      },
    ],
    availability,
    openSeats: availability === "open" ? 1 : 0,
    waitlistCount: availability === "waitlist" ? 1 : 0,
    existingScheduleConflict,
  };
}

const MORNING = { start: 600, end: 660 };
const AFTERNOON = { start: 780, end: 840 };

function firstInstructor(result, index = 0) {
  return result.options[index].sections[0].selectedInstructor.displayName;
}

test("parses and normalizes common UC Davis course-code formats", () => {
  assert.deepEqual(
    core.parseCourseCodes("CHE002A, MAT 21A\nche 002a; ECS-036A"),
    ["CHE 002A", "MAT 021A", "ECS 036A"],
  );
});

test("classifies 0/0 sections as unavailable", () => {
  assert.equal(core.classifyAvailability(0, 0), "unavailable");
  assert.equal(core.classifyAvailability(0, 4), "waitlist");
  assert.equal(core.classifyAvailability(3, 0), "open");
  assert.equal(core.classifyAvailability(null, null), "unknown");
});

test("normalizes the Schedule Builder result shape captured in the CHE 002A archive", () => {
  const normalized = core.normalizeSearchResult({
    course: {
      subjectCode: "CHE",
      courseNum: "002A",
      shortDesc: "CHE 002A A01",
      printCRN: "24335",
      hidCRN: "24335",
      title: "General Chemistry",
    },
    instructor: [{ instructorName: "O. Gulacar", instructorEmail: "ogulacar@ucdavis.edu" }],
    meeting: [
      {
        description: "Lecture",
        daysString: "TR",
        startTime: "1340",
        endTime: "1500",
        tuesday: true,
        thursday: true,
        building: "California Hall",
        room: "1100",
      },
    ],
    seats: { seatsAvail: "0", waitCount: "0" },
    existingScheduleConflict: true,
  });
  assert.equal(normalized.courseKey, "CHE 002A");
  assert.equal(normalized.crn, "24335");
  assert.equal(normalized.availability, "unavailable");
  assert.equal(normalized.existingScheduleConflict, true);
  assert.deepEqual(normalized.meetings[0].days, ["T", "R"]);
  assert.equal(normalized.meetings[0].startMinutes, 13 * 60 + 40);
  // Instructor emails must never reach the planner.
  assert.deepEqual(normalized.instructors[0], { displayName: "O. Gulacar", rmp: null });
});

test("detects overlapping meetings only when they share a day", () => {
  const monday = [{ days: ["M"], startMinutes: 600, endMinutes: 660, isTba: false }];
  const mondayOverlap = [{ days: ["M"], startMinutes: 650, endMinutes: 700, isTba: false }];
  const tuesday = [{ days: ["T"], startMinutes: 650, endMinutes: 700, isTba: false }];
  assert.equal(core.meetingsConflict(monday, mondayOverlap), true);
  assert.equal(core.meetingsConflict(monday, tuesday), false);
});

test("unknown slider values fall back to the neutral middle stop", () => {
  const preferences = core.normalizeSchedulerPreferences({
    timeBlocks: { morning: "preferred", afternoon: 99 },
    days: { M: 0, Q: 4 },
  });
  assert.equal(preferences.timeBlocks.morning, 2);
  assert.equal(preferences.timeBlocks.afternoon, 2);
  assert.equal(preferences.days.M, 0);
  assert.equal(preferences.days.W, 2);
  assert.equal(preferences.days.Q, undefined);
});

test("returns every conflict-free combination, best first", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "A. Alpha", rating: 4.7, days: ["M"], ...MORNING }),
      ],
    },
    {
      courseKey: "MAT 021A",
      sections: [
        // Overlaps CHE 002A, so it can never appear in an option.
        section({ courseKey: "MAT 021A", section: "A01", instructor: "B. Beta", rating: 5, days: ["M"], start: 630, end: 690 }),
        section({ courseKey: "MAT 021A", section: "A02", instructor: "B. Beta", rating: 5, days: ["T"], start: 630, end: 690 }),
        section({ courseKey: "MAT 021A", section: "A03", instructor: "C. Gamma", rating: 2, days: ["W"], start: 630, end: 690 }),
      ],
    },
  ];
  const result = core.generateSchedules(groups, { ratingWeight: 1 });
  assert.equal(result.ok, true);
  // The overlapping A01 is only reachable by relaxing conflicts, which this
  // course set never needs, so it must not appear.
  assert.equal(result.options.length, 2);
  assert.equal(result.options[0].sections[1].section, "MAT 021A A02");
  assert.equal(result.options[1].sections[1].section, "MAT 021A A03");
  assert.equal(result.options[0].averageRating, (4.7 + 5) / 2);
});

test("maxOptions caps how many combinations come back", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [1, 2, 3, 4, 5].map((index) =>
        section({
          courseKey: "CHE 002A",
          section: `A0${index}`,
          instructor: `Prof ${index}`,
          rating: index,
          days: ["M"],
          start: 540 + index * 70,
          end: 590 + index * 70,
        }),
      ),
    },
  ];
  assert.equal(core.generateSchedules(groups, { maxOptions: 2 }).options.length, 2);
  assert.equal(core.generateSchedules(groups, {}).options.length, 5);
});

test("building around a section keeps it in every returned combination", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "A. Alpha", rating: 5, days: ["M"], ...MORNING }),
        section({ courseKey: "CHE 002A", section: "A02", instructor: "B. Beta", rating: 2, days: ["T"], ...MORNING }),
      ],
    },
    {
      courseKey: "MAT 021A",
      sections: [
        section({ courseKey: "MAT 021A", section: "A01", instructor: "C. Gamma", rating: 4, days: ["W"], ...MORNING }),
        section({ courseKey: "MAT 021A", section: "A02", instructor: "D. Delta", rating: 3, days: ["R"], ...MORNING }),
      ],
    },
  ];
  const pinned = new Map([["CHE 002A", "CHE 002A-A02"]]);
  const result = core.generateSchedules(groups, { pinned });
  assert.equal(result.options.length, 2);
  assert.equal(
    result.options.every((option) =>
      option.sections.some((item) => item.saveKey === "CHE 002A-A02"),
    ),
    true,
  );
});

test("waitlisted sections rank last, and compete once they are allowed", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "Wait List", rating: 5, days: ["M"], ...MORNING, availability: "waitlist" }),
        section({ courseKey: "CHE 002A", section: "A02", instructor: "Open Seats", rating: 1, days: ["T"], ...MORNING }),
      ],
    },
  ];
  // The higher-rated section is waitlisted, so it still sorts last by default.
  const byDefault = core.generateSchedules(groups, { ratingWeight: 1 });
  assert.equal(firstInstructor(byDefault), "Open Seats");
  assert.deepEqual(byDefault.options[0].limits, []);
  assert.deepEqual(byDefault.options[1].limits, ["waitlist"]);

  const allowed = core.generateSchedules(groups, { ratingWeight: 1, includeWaitlist: true });
  assert.equal(firstInstructor(allowed), "Wait List");
  assert.deepEqual(allowed.options[0].limits, []);
  assert.equal(allowed.options[0].hasWaitlist, true);
});

test("still returns closed and clashing sections when nothing clean exists", () => {
  const result = core.generateSchedules([
    {
      courseKey: "ECS 160",
      sections: [
        section({ courseKey: "ECS 160", section: "A01", instructor: "Closed", rating: 5, days: ["M"], ...MORNING, availability: "unavailable" }),
        section({ courseKey: "ECS 160", section: "A02", instructor: "Clashes", rating: 3, days: ["M"], ...MORNING, existingScheduleConflict: true }),
      ],
    },
  ], {});
  assert.equal(result.ok, true);
  // Clashing with the saved schedule is a smaller compromise than no seats.
  assert.equal(firstInstructor(result), "Clashes");
  assert.deepEqual(result.options[0].limits, ["existingConflict"]);
  assert.deepEqual(result.options[1].limits, ["closed"]);
});

test("falls back to overlapping options when no timetable fits", () => {
  const clash = { days: ["M"], ...MORNING };
  const result = core.generateSchedules([
    {
      courseKey: "ECS 160",
      sections: [section({ courseKey: "ECS 160", section: "A01", instructor: "A. Alpha", rating: 4, ...clash })],
    },
    {
      courseKey: "MAT 021A",
      sections: [section({ courseKey: "MAT 021A", section: "A01", instructor: "B. Beta", rating: 4, ...clash })],
    },
  ], {});
  assert.equal(result.ok, true);
  assert.equal(result.options[0].sections.length, 2);
  assert.deepEqual(result.options[0].limits, ["overlap"]);
  assert.deepEqual(result.options[0].overlaps, [["ECS 160 A01", "MAT 021A A01"]]);
});

test("only gives up when a course has no sections at all", () => {
  const result = core.generateSchedules([{ courseKey: "CHE 002A", sections: [] }], {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_sections");
  assert.equal(result.courseKey, "CHE 002A");
});

test("ratingWeight slides the ranking between class times and professor ratings", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "Highest Rating", rating: 5, days: ["T"], ...AFTERNOON }),
        section({ courseKey: "CHE 002A", section: "A02", instructor: "Best Time", rating: 2, days: ["M"], ...MORNING }),
      ],
    },
  ];
  const preferences = {
    days: { M: 4, T: 0 },
    timeBlocks: { morning: 4, afternoon: 0 },
  };
  assert.equal(firstInstructor(core.generateSchedules(groups, { preferences, ratingWeight: 0 })), "Best Time");
  assert.equal(firstInstructor(core.generateSchedules(groups, { preferences, ratingWeight: 1 })), "Highest Rating");
});

test("time match reflects how well a section lands on preferred days and times", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "A. Alpha", rating: 3, days: ["M"], ...MORNING }),
      ],
    },
  ];
  const loved = core.generateSchedules(groups, {
    preferences: { days: { M: 4 }, timeBlocks: { morning: 4 } },
  });
  const hated = core.generateSchedules(groups, {
    preferences: { days: { M: 0 }, timeBlocks: { morning: 0 } },
  });
  assert.equal(loved.options[0].timeMatch, 1);
  assert.equal(hated.options[0].timeMatch, 0);
});

test("invalid search limits fall back to the defaults", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({ courseKey: "CHE 002A", section: "A01", instructor: "A. Alpha", rating: 4.5, days: ["M"], ...MORNING }),
      ],
    },
  ];
  for (const invalid of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = core.generateSchedules(groups, { maxExplored: invalid, maxOptions: invalid });
    assert.equal(result.ok, true);
    assert.equal(result.truncated, false);
    assert.equal(result.options.length, 1);
  }
});

test("seat summaries stay short and use the RMP badge tones", () => {
  assert.deepEqual(
    core.seatSummary({ availability: "open", openSeats: 12 }),
    { label: "12", tone: "good" },
  );
  assert.deepEqual(
    core.seatSummary({ availability: "waitlist", waitlistCount: 4 }),
    { label: "WL 4", tone: "mid" },
  );
  assert.deepEqual(
    core.seatSummary({ availability: "unavailable" }),
    { label: "Full", tone: "low" },
  );
});
