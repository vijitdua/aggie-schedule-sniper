const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

require("../shared/changelog.js");
const { parseChangelog } = globalThis.ASS_CHANGELOG;

test("parseChangelog reads Keep a Changelog releases", () => {
  const markdown = `# Changelog

## [Unreleased]

## [4.1.1] - 2026-09-20

### Fixed

- Calendar \`.ics\` export mid-week **DTSTART** fix
- Second bullet

### Changed

- Manifest version **4.1.1**.

## [4.0.0] - 2026-09-13

### Added

- Advanced Planner
`;

  const releases = parseChangelog(markdown);
  assert.equal(releases.length, 2);
  assert.equal(releases[0].version, "4.1.1");
  assert.equal(releases[0].date, "2026-09-20");
  assert.equal(releases[0].sections[0].heading, "Fixed");
  assert.equal(
    releases[0].sections[0].bullets[0],
    "Calendar .ics export mid-week DTSTART fix",
  );
  assert.equal(releases[1].version, "4.0.0");
});

test("parseChangelog handles the real CHANGELOG.md", () => {
  const markdown = fs.readFileSync(
    path.join(__dirname, "..", "CHANGELOG.md"),
    "utf8",
  );
  const releases = parseChangelog(markdown);
  assert.ok(releases.length >= 3);
  assert.equal(releases[0].version, "4.1.1");
  assert.ok(releases.some((r) => r.version === "4.0.0"));
  assert.ok(!releases.some((r) => /^unreleased$/i.test(r.version)));
});
