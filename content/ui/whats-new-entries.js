/**
 * Newest-first What’s New entries for returning users.
 * Add one entry per user-facing release. Invisible patches: skip.
 * Keep `version` in sync with the manifest only when you cut that release —
 * do not bump the manifest early; leave unreleased work under CHANGELOG [Unreleased].
 */
window.ASS_WHATS_NEW_ENTRIES = [
  {
    // Calendar export existed before 4.1.0 — this release fixes term detection
    // and makes quarter/dates editable in the modal.
    // Advanced planner existed before 4.0.0 — we re-highlight it since the releases are so close to each other and some people might jump directly from 3.x.x to 4.1.0 (skipping 4.0.0)
    id: "calendar-term-fix-4-1-0",
    version: "4.1.0",
    date: "2026-09-14",
    headline: "Advanced Planner + calendar export",
    bullets: [
      "Advanced Planner: A new and improved way to find and search for your courses",
      "Calendar export improvements: edit the quarter or dates, with improved automatic quarter dates fetched from the registrar",
    ],
  },
  {
    id: "advanced-planner",
    version: "4.0.0",
    date: "2026-09-13",
    headline: "Advanced Planner",
    bullets: [
      "See every conflict-free way to take your courses",
      "Save the plan you like straight into Schedule Builder",
    ],
  },
];
