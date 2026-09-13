# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Advanced Planner**: find the perfect schedule for you based on your preferences across all combinations of courses. Type courses, slide times/days/rating balance, pick sections one at a time into a selected tray (remaining options only show what's left; selected times stay greyed on other calendars), then save to Schedule Builder. Save replaces only matching unregistered sections and skips registered/waitlisted courses. When no clean schedule exists, it still shows the closest options and says exactly what had to give.
- Planner launchers in the popup and next to Schedule Builder's course search, plus a visibility toggle.
- Unit tests for course parsing, seat classification, conflict detection, the solver, and the MAIN-world bridge.

### Changed

- Manifest version **3.1.0**.

### Fixed
- RMP ratings now appear in the **Add / Search Courses** modal (`[role='dialog']`), not only inline search results.
- RMP watches `document.body` so ratings inject when the search modal opens dynamically.
- Developer menu: **Clear all caches** near the top (registrar calendar + RMP).
- RMP no longer caches transient lookup failures (API errors, rate limits) as permanent 7-day misses; legacy false misses are dropped on load.

## [3.0.0] - 2026-05-29

### Added

- RateMyProfessors reviews: toggle in popup and dev menu (default on); ASS-styled review card below instructor names in search and saved schedule, with color-coded rating stats.
- Background RMP GraphQL lookup with 7-day local cache, deduplicated fetches, and dev **Clear RMP cache** action.
- Onboarding bullet for RMP ratings; developer **Professor ratings** advanced config group.

### Changed

- Manifest version **3.0.0**; store `name` mentions RMP ratings.
- Settings and onboarding backdrops use neutral **65%** black overlay.
- Opening **How it works** from settings closes the settings panel first (no double overlay).
- First-run onboarding dismisses only via **Continue**; manually opened onboarding can dismiss on backdrop click.

### Fixed

- RMP cache no longer wiped on every save (stopped refetch/flicker during deep search).
- One lookup per professor name shared across all visible course sections.

## [2.3.3] - 2026-05-29

### Added

- Google Calendar export flow: download `.ics`, then in-modal steps to import (with link to Google Calendar **Settings → Import & export**).
- **Download .ics again** on the Google import step (Schedule Builder export modal).

### Fixed

- Calendar export: weekly events now end at quarter instruction end (Pacific `RRULE` `UNTIL`) instead of repeating indefinitely.
- Registrar quarter dates (e.g. `Sep 23`, `Dec 4 @ 11:59 p.m.`) are normalized before export; unparseable dates prompt for manual start/end instead of failing silently.
- Export modal shows a formatted date range (e.g. `Sep 23 – Dec 4, 2026`), not raw registrar strings.

### Changed

- `.ics` files use `America/Los_Angeles`, `ass-` filename prefix, and `ass-…@ass.vijit.app` UIDs.
- Schedule Builder toolbar and popup: **Export Calendar** label.
- Floating overlay launcher label: **ass.vijit.app**.
- Onboarding dismiss storage key bumped (`assOnboardingDismissed_v2`) so updating users see the welcome modal again.
- Manifest `short_name`: **Aggie Schedule Sniper**.

## [2.3.2] - 2026-05-28

### Fixed

- Calendar export prompts for quarter start/end dates on every export when registrar data is unavailable, instead of reusing stored manual dates.

## [2.3.1] - 2026-05-28

### Fixed

- Shorten manifest `name` to fit Chrome Web Store 75-character limit.

## [2.3.0] - 2026-05-28

### Added

- **Export calendar (.ics)** from Schedule Builder — registered and waitlisted courses only, with confirm preview before download.
- Export buttons on Schedule Builder page, extension overlay, and popup.
- Quarter dates auto-fetched from [registrar.ucdavis.edu/calendar/quarter](https://registrar.ucdavis.edu/calendar/quarter) (cached in background).
- **Advanced / Developer Menu** — triple-click version in popup footer; override regexes, selectors, timings; reset to default.

### Changed

- Calendar event titles use `{code section}[W]: {course name}` format for waitlisted courses.

## [2.2.4] - 2026-05-28

### Fixed

- **Keep me logged in** now auto-clicks the UC Davis **Continue Session** modal when it appears.
- Session expiry warning no longer false-alarms on the term-picker page (only triggers when that modal is actually visible).

### Changed

- Session keep-alive modal handling simplified: detect visible **Continue Session** button, warn, and click.

## [2.2.3] - 2026-05-28

### Changed

- Popup footer labels modified: **More Apps**, **Contributors**, and **Get Help / Support**.

## [2.2.2] - 2026-05-26

### Changed

- Support links now point to the app-specific page [vijitdua.com/support/ass](https://vijitdua.com/support/ass).

## [2.2.1] - 2026-05-23

### Changed

- Open-source links now point to [vijitdua.com/open-source](https://vijitdua.com/open-source) instead of contribution guideline path.

## [2.2.0] - 2026-05-23

### Added

- Settings popup: info button in the header (top right) reopens the welcome / how-it-works modal
- Onboarding modal: share button (top right) copies the extension link with copied-to-clipboard feedback
- **Keep me logged in** setting (session heartbeat, tab-close warning, screen wake lock) while waiting for pass time
- Hover tooltips on all popup toggles
- Session debug logs (`session_guard`, `session_keepalive`, `session_close_warning`, `session_wake_lock`, `session_expiry_warning`)
- Onboarding bullets covering competitive registration, Schedule Builder requirements, and UC Davis idle logout
- Session expiry overlay chip when Continue Session, CAS login, or pass-times UI is missing
- Tab-close warning while sniping (reloads allowed; tab close warning - browser shows its generic leave dialog)

## [2.1.0] - 2026-05-23

Initial open-source release (MIT).

### Added

- Schedule Builder integration: pass-time countdown and optional **Register ALL** at your registration window
- Extension popup (settings, share, social links, **Copy debug logs**)
- First-run onboarding modal on Schedule Builder
- URL test helpers: `?ucdTest=30` (simulated pass), `?assReset=1` (show onboarding again)
- `releases` and `develop` branches; [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), GitHub issue/PR templates
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Branding and fork guidance: [branding/official.js](branding/official.js), [TRADEMARK.md](TRADEMARK.md)
