const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createBridgeHarness({
  activeCourseText = "",
  replaceableCourseText = "",
  includeSecondCourse = false,
  rejectDuplicateAdd = false,
  conflictText = "This course has a time conflict with Existing Course",
} = {}) {
  let messageListener = null;
  const posted = [];
  const saved = [];
  const seatTerms = [];
  const rawCourse = {
    course: {
      subjectCode: "CHE",
      courseNum: "002A",
      shortDesc: "CHE 002A A01",
      seqNum: "A01",
      printCRN: "24335",
      hidCRN: "24335",
      crn: "24335",
      title: "General Chemistry",
      unitsLow: 5,
      dropDate: "1/15/2027 (10 Day Drop)",
      bookstoreURL: "https://ucdavisstores.com/",
    },
    instructor: [{ instructorName: "O. Gulacar", lastName: "Gulacar", instructorEmail: "ogulacar@ucdavis.edu" }],
    meeting: [{
      description: "Lecture",
      daysString: "TR",
      startTime: "1340",
      endTime: "1500",
      building: "Chemistry",
      room: "194",
    }],
    finalExam: { examDate: "December, 07 2026 13:00:00" },
    icmsData: {
      newDescription: "Stoichiometry, atomic structure, and bonding.",
      geCredit: "SE",
      formerGeCredit: "Sci",
      catalogURL: "https://catalog.ucdavis.edu/search/?P=CHE%20002A",
    },
  };
  const secondCourse = {
    course: {
      subjectCode: "MAT",
      courseNum: "021A",
      shortDesc: "MAT 021A A01",
      printCRN: "55555",
      hidCRN: "55555",
      crn: "55555",
      title: "Calculus",
    },
    instructor: [{ instructorName: "A. Professor" }],
    meeting: [],
  };
  let cardRemoved = false;
  const savedCardText = activeCourseText || replaceableCourseText;
  const savedCard = savedCardText
    ? {
        textContent: savedCardText,
        querySelectorAll(selector) {
          if (selector === "button, a, input" && replaceableCourseText) {
            return [{
              textContent: "Remove course",
              click() {
                cardRemoved = true;
              },
              getAttribute() {
                return null;
              },
            }];
          }
          return [];
        },
      }
    : null;
  const window = {
    location: {
      origin: "https://my.ucdavis.edu",
      search: "?termCode=202610",
    },
    user: { pidm: 123, init() {} },
    search: {
      async search() {
        return includeSecondCourse ? { 0: rawCourse, 1: secondCourse } : { 0: rawCourse };
      },
      async fetchSeatAvailability(_crn, termCode) {
        seatTerms.push(termCode);
        return { seatsAvail: 4, waitCount: 2 };
      },
    },
    schedule: {
      timeConflict: {
        Load() {},
        checkCourse() {
          return {
            bool: true,
            text: conflictText,
          };
        },
      },
      async addCourse(course) {
        if (rejectDuplicateAdd && !cardRemoved) {
          throw new Error("Duplicate course");
        }
        saved.push(course.course.crn);
      },
    },
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("article.CourseItem") && savedCard && !cardRemoved
          ? [savedCard]
          : [];
      },
      contains(card) {
        return card === savedCard && !cardRemoved;
      },
    },
    addEventListener(type, listener) {
      if (type === "message") messageListener = listener;
    },
    postMessage(message) {
      posted.push(message);
    },
  };
  window.top = window;
  const source = fs.readFileSync(
    path.join(__dirname, "../content/page-scheduler-bridge.js"),
    "utf8",
  );
  vm.runInNewContext(source, { window, setTimeout, clearTimeout, console });

  async function request(id, action, payload) {
    messageListener({
      source: window,
      origin: window.location.origin,
      data: {
        channel: "ASS_ADVANCED_PLANNER_BRIDGE_V1",
        direction: "request",
        id,
        action,
        payload,
      },
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = posted.find((message) => message.id === id && message.kind === "result");
      if (result) return result.payload;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    throw new Error("Bridge response timed out in test");
  }

  return { request, saved, seatTerms };
}

test("MAIN-world bridge returns all results with live seats and saves remembered CRNs", async () => {
  const harness = createBridgeHarness();
  const searched = await harness.request("search-1", "search_courses", { query: "CHE 002A" });
  assert.equal(searched.ok, true);
  assert.equal(searched.results.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(searched.results[0].seats)),
    { seatsAvail: 4, waitCount: 2 },
  );
  assert.equal(searched.results[0].existingScheduleConflict, true);
  assert.equal(searched.results[0].instructor?.[0]?.instructorEmail, undefined);
  assert.equal("instructorEmail" in (searched.results[0].instructor?.[0] || {}), false);

  const suggestions = await harness.request("suggest-1", "suggest_courses", {
    query: "CHE 2A",
  });
  assert.equal(suggestions.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(suggestions.suggestions)),
    [{ courseKey: "CHE 002A", title: "General Chemistry" }],
  );

  const conflicts = await harness.request("conflicts-1", "check_existing_conflicts", {
    courseKeys: ["24335"],
  });
  assert.equal(conflicts.ok, true);
  assert.equal(conflicts.results[0].conflict, true);

  const saved = await harness.request("save-1", "save_courses", { crns: ["24335"] });
  assert.equal(saved.ok, true);
  assert.deepEqual(harness.saved, ["24335"]);
  assert.equal(saved.results[0].ok, true);

  const details = await harness.request("details-1", "get_course_details", { crn: "24335" });
  assert.equal(details.ok, true);
  assert.equal(details.details.icmsData.newDescription, "Stoichiometry, atomic structure, and bonding.");
  assert.equal(details.details.finalExam.examDate, "December, 07 2026 13:00:00");
  assert.equal(details.details.instructor[0].instructorEmail, "ogulacar@ucdavis.edu");
  assert.equal(details.details.meeting[0].building, "Chemistry");
});

test("save skips a registered same-course section but saves the other courses", async () => {
  const harness = createBridgeHarness({
    activeCourseText:
      "CHE 002A A02 General Chemistry Registration Status: Registered CRN: 11111",
    includeSecondCourse: true,
  });
  await harness.request("search-1", "search_courses", { query: "courses" });

  const result = await harness.request("save-1", "save_courses", {
    crns: ["24335", "55555"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.results[0].ok, false);
  assert.match(result.results[0].error, /already registered/i);
  assert.equal(result.results[1].ok, true);
  assert.deepEqual(harness.saved, ["55555"]);
});

test("save replaces only an unregistered section of the same course", async () => {
  const harness = createBridgeHarness({
    replaceableCourseText:
      "CHE 002A A02 General Chemistry Registration Status: Not Registered CRN: 11111",
    rejectDuplicateAdd: true,
  });
  const searched = await harness.request("search-1", "search_courses", { query: "CHE 002A" });
  assert.equal(searched.results[0].existingScheduleConflict, false);

  const result = await harness.request("save-1", "save_courses", { crns: ["24335"] });

  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[0].replaced, true);
  assert.deepEqual(harness.saved, ["24335"]);
});

test("same-course replacement still reports conflicts with another course", async () => {
  const harness = createBridgeHarness({
    replaceableCourseText:
      "CHE 002A A02 General Chemistry Registration Status: Not Registered CRN: 11111",
    conflictText: "This course has a time conflict with MAT 021A",
  });

  const searched = await harness.request("search-1", "search_courses", { query: "CHE 002A" });
  assert.equal(searched.results[0].existingScheduleConflict, true);
});
