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
  openSeats = availability === "open" ? 1 : 0,
  waitlistCount = availability === "waitlist" ? 1 : 0,
  existingScheduleConflict = false,
}) {
  return {
    courseKey,
    section: `${courseKey} ${sectionName}`,
    crn: `${courseKey}-${sectionName}`,
    instructors: [
      {
        displayName: instructor,
        rmp: rating == null ? null : { rating, reviewCount: 10 },
      },
    ],
    selectedInstructor: null,
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
    openSeats,
    waitlistCount,
    existingScheduleConflict,
  };
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
      seqNum: "A01",
      printCRN: "24335",
      hidCRN: "24335",
      title: "General Chemistry",
      unitsLow: 5,
    },
    instructor: [
      {
        instructorName: "O. Gulacar",
        firstName: "Omer",
        lastName: "Gulacar",
        instructorEmail: "ogulacar@ucdavis.edu",
      },
    ],
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
    finalExam: { examDate: "December, 07 2026 13:00:00" },
    existingScheduleConflict: true,
    existingScheduleConflictText: "This course has a time conflict with Existing Course",
  });
  assert.equal(normalized.courseKey, "CHE 002A");
  assert.equal(normalized.crn, "24335");
  assert.equal(normalized.availability, "unavailable");
  assert.equal(normalized.existingScheduleConflict, true);
  assert.match(normalized.existingScheduleConflictText, /Existing Course/);
  assert.deepEqual(normalized.meetings[0].days, ["T", "R"]);
  assert.equal(normalized.meetings[0].startMinutes, 13 * 60 + 40);
});

test("detects overlapping meetings only when they share a day", () => {
  const monday = [{ days: ["M"], startMinutes: 600, endMinutes: 660, isTba: false }];
  const mondayOverlap = [{ days: ["M"], startMinutes: 650, endMinutes: 700, isTba: false }];
  const tuesday = [{ days: ["T"], startMinutes: 650, endMinutes: 700, isTba: false }];
  assert.equal(core.meetingsConflict(monday, mondayOverlap), true);
  assert.equal(core.meetingsConflict(monday, tuesday), false);
});

test("manual scheduling respects professor choices and avoids conflicts", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "A. Alpha",
          rating: 4.7,
          days: ["M"],
          start: 600,
          end: 660,
        }),
      ],
    },
    {
      courseKey: "MAT 021A",
      sections: [
        section({
          courseKey: "MAT 021A",
          section: "A01",
          instructor: "B. Beta",
          rating: 4.0,
          days: ["M"],
          start: 630,
          end: 690,
        }),
        section({
          courseKey: "MAT 021A",
          section: "A02",
          instructor: "B. Beta",
          rating: 4.0,
          days: ["T"],
          start: 630,
          end: 690,
        }),
      ],
    },
  ];
  const result = core.generateSchedule(groups, {
    selections: new Map([
      ["CHE 002A", "A. Alpha"],
      ["MAT 021A", "B. Beta"],
    ]),
  });
  assert.equal(result.ok, true);
  assert.equal(result.schedule.find((item) => item.courseKey === "MAT 021A").section, "MAT 021A A02");
});

test("rating auto-mode prefers an all-open schedule over a higher-rated waitlist", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Wait List",
          rating: 5,
          days: ["M"],
          start: 600,
          end: 660,
          availability: "waitlist",
        }),
        section({
          courseKey: "CHE 002A",
          section: "A02",
          instructor: "Open Seats",
          rating: 3,
          days: ["T"],
          start: 600,
          end: 660,
          availability: "open",
        }),
      ],
    },
  ];
  const result = core.generateSchedule(groups, { autoRatings: true });
  assert.equal(result.ok, true);
  assert.equal(result.schedule[0].selectedInstructor.displayName, "Open Seats");
  assert.equal(result.hasWaitlist, false);
});

test("schedule generation never selects a 0/0 section", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Closed Course",
          rating: 5,
          days: ["M"],
          start: 600,
          end: 660,
          availability: "unavailable",
        }),
      ],
    },
  ];
  const result = core.generateSchedule(groups, { autoRatings: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_eligible_sections");
});

test("schedule generation excludes sections that conflict with the current Schedule", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Higher Rating",
          rating: 5,
          days: ["M"],
          start: 600,
          end: 660,
          existingScheduleConflict: true,
        }),
        section({
          courseKey: "CHE 002A",
          section: "A02",
          instructor: "No Conflict",
          rating: 3.5,
          days: ["T"],
          start: 600,
          end: 660,
        }),
      ],
    },
  ];
  const result = core.generateSchedule(groups, { autoRatings: true });
  assert.equal(result.ok, true);
  assert.equal(result.schedule[0].selectedInstructor.displayName, "No Conflict");
});

test("invalid maxExplored values fall back to the default search limit", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "A. Alpha",
          rating: 4.5,
          days: ["M"],
          start: 600,
          end: 660,
        }),
      ],
    },
  ];
  for (const maxExplored of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = core.generateSchedule(groups, {
      priority: "rating",
      maxExplored,
    });
    assert.equal(result.ok, true);
    assert.equal(result.truncated, false);
  }
});

test("time and rating priority use opposite primary weights", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Highest Rating",
          rating: 5,
          days: ["T"],
          start: 780,
          end: 840,
        }),
        section({
          courseKey: "CHE 002A",
          section: "A02",
          instructor: "Best Time",
          rating: 2,
          days: ["M"],
          start: 600,
          end: 660,
        }),
      ],
    },
  ];
  const preferences = {
    preferredDays: ["M"],
    timeBlocks: { morning: "preferred", afternoon: "avoid" },
  };
  const byTime = core.generateSchedule(groups, {
    priority: "time",
    preferences,
  });
  const byRating = core.generateSchedule(groups, {
    priority: "rating",
    preferences,
  });
  assert.equal(byTime.schedule[0].selectedInstructor.displayName, "Best Time");
  assert.equal(byRating.schedule[0].selectedInstructor.displayName, "Highest Rating");
});

test("each automatic priority keeps the other factor as a tie-breaker", () => {
  const ratingTie = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Same Rating Bad Time",
          rating: 4,
          days: ["T"],
          start: 780,
          end: 840,
        }),
        section({
          courseKey: "CHE 002A",
          section: "A02",
          instructor: "Same Rating Good Time",
          rating: 4,
          days: ["M"],
          start: 600,
          end: 660,
        }),
      ],
    },
  ];
  const timeTie = [
    {
      courseKey: "MAT 021A",
      sections: [
        section({
          courseKey: "MAT 021A",
          section: "A01",
          instructor: "Lower Rating",
          rating: 2,
          days: ["M"],
          start: 600,
          end: 660,
        }),
        section({
          courseKey: "MAT 021A",
          section: "A02",
          instructor: "Higher Rating",
          rating: 4.8,
          days: ["M"],
          start: 600,
          end: 660,
        }),
      ],
    },
  ];
  const preferences = {
    preferredDays: ["M"],
    timeBlocks: { morning: "preferred", afternoon: "avoid" },
  };
  const byRating = core.generateSchedule(ratingTie, {
    priority: "rating",
    preferences,
  });
  const byTime = core.generateSchedule(timeTie, {
    priority: "time",
    preferences,
  });
  assert.equal(byRating.schedule[0].selectedInstructor.displayName, "Same Rating Good Time");
  assert.equal(byTime.schedule[0].selectedInstructor.displayName, "Higher Rating");
});

test("Never time blocks are hard exclusions in every planning mode", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "Morning Professor",
          rating: 5,
          days: ["M"],
          start: 600,
          end: 660,
        }),
        section({
          courseKey: "CHE 002A",
          section: "A02",
          instructor: "Afternoon Professor",
          rating: 3,
          days: ["M"],
          start: 780,
          end: 840,
        }),
      ],
    },
  ];
  const preferences = { timeBlocks: { morning: "never" } };
  for (const priority of ["time", "rating"]) {
    const result = core.generateSchedule(groups, { priority, preferences });
    assert.equal(result.ok, true);
    assert.equal(result.schedule[0].selectedInstructor.displayName, "Afternoon Professor");
  }
  const manual = core.generateSchedule(groups, {
    priority: "manual",
    preferences,
    selections: new Map([["CHE 002A", "Morning Professor"]]),
  });
  assert.equal(manual.ok, false);
  assert.equal(manual.reason, "no_eligible_sections");
  assert.equal(manual.blockedByTimePreferences, true);
});

test("prompt includes RMP, seat status, meetings, and scheduling preferences", () => {
  const groups = [
    {
      courseKey: "CHE 002A",
      title: "General Chemistry",
      sections: [
        section({
          courseKey: "CHE 002A",
          section: "A01",
          instructor: "O. Gulacar",
          rating: 4.5,
          days: ["T", "R"],
          start: 820,
          end: 900,
          existingScheduleConflict: true,
        }),
      ],
    },
  ];
  const prompt = core.buildPrompt(groups, "Fall 2026", {
    preferredDays: ["T", "R"],
    timeBlocks: { morning: "preferred", evening: "never" },
  });
  assert.match(prompt, /CHE 002A/);
  assert.match(prompt, /RMP 4\.5\/5/);
  assert.match(prompt, /CRN CHE 002A-A01/);
  assert.match(prompt, /TR 1:40 PM-3:00 PM/);
  assert.match(prompt, /current Schedule Builder schedule/);
  assert.match(prompt, /CONFLICTS WITH CURRENT SCHEDULE/);
  assert.match(prompt, /Preferred weekdays: Tuesday, Thursday/);
  assert.match(prompt, /Never schedule in: Evening/);
});
