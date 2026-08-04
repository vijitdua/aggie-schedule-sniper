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
  });
  assert.equal(normalized.courseKey, "CHE 002A");
  assert.equal(normalized.crn, "24335");
  assert.equal(normalized.availability, "unavailable");
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

test("prompt includes RMP, seat status, CRN, and meeting data", () => {
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
        }),
      ],
    },
  ];
  const prompt = core.buildPrompt(groups, "Fall 2026");
  assert.match(prompt, /CHE 002A/);
  assert.match(prompt, /RMP 4\.5\/5/);
  assert.match(prompt, /CRN CHE 002A-A01/);
  assert.match(prompt, /TR 1:40 PM-3:00 PM/);
});
