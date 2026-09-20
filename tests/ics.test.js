const assert = require("node:assert/strict");
const test = require("node:test");

require("../shared/ics.js");
const ICS = globalThis.ASS_ICS;

test("firstOccurrenceOnOrAfterAny picks earliest BYDAY when term starts mid-week", () => {
  // Fall 2026 instruction begins Wednesday, Sep 23
  const start = { y: 2026, m: 9, d: 23 };

  assert.deepEqual(ICS.firstOccurrenceOnOrAfter(start, "MO"), {
    y: 2026,
    m: 9,
    d: 28,
  });
  assert.deepEqual(ICS.firstOccurrenceOnOrAfterAny(start, ["MO", "WE", "FR"]), {
    y: 2026,
    m: 9,
    d: 23,
  });
  assert.deepEqual(ICS.firstOccurrenceOnOrAfterAny(start, ["TU", "TH"]), {
    y: 2026,
    m: 9,
    d: 24,
  });
  assert.deepEqual(ICS.firstOccurrenceOnOrAfterAny(start, ["WE"]), {
    y: 2026,
    m: 9,
    d: 23,
  });
});

test("buildIcs DTSTART for MWF uses Wed when instruction begins Wed", () => {
  const startBase = { y: 2026, m: 9, d: 23 };
  const endDate = { y: 2026, m: 12, d: 4 };
  const occurrence = ICS.firstOccurrenceOnOrAfterAny(startBase, [
    "MO",
    "WE",
    "FR",
  ]);
  const start = ICS.parseTimeOnDate(occurrence, "9:00 AM");
  const end = ICS.parseTimeOnDate(occurrence, "9:50 AM");
  const ics = ICS.buildIcs([
    {
      uid: "test@ass.vijit.app",
      start,
      end,
      summary: "ECS 160 001 (Lecture)",
      rrule: ICS.buildRrule(["MO", "WE", "FR"], endDate),
    },
  ]);

  assert.match(
    ics,
    /DTSTART;TZID=America\/Los_Angeles:20260923T090000/,
  );
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;/);
});
