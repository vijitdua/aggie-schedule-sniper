# Aggie Schedule Sniper

<p align="center">
  <a href="https://ass.vijit.app">
    <img src="https://img.shields.io/badge/Install_extension-ass.vijit.app-2E7D32?style=for-the-badge" alt="Install at ass.vijit.app">
  </a>
  <a href="https://vijitdua.com">
    <img src="https://img.shields.io/badge/Built_by-vijitdua.com-1565C0?style=for-the-badge" alt="vijitdua.com">
  </a>
</p>

<p align="center">
  <strong><a href="https://ass.vijit.app">ass.vijit.app</a></strong>
  &nbsp;·&nbsp;
  <strong><a href="https://vijitdua.com">vijitdua.com</a></strong>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chrome extension for UC Davis students using Schedule Builder. Advanced Planner finds the perfect schedule for you based on your preferences across all combinations of courses (with live seats + professor ratings), watches your pass time, shows a countdown, and clicks Register ALL automatically when your registration window opens.

**Not affiliated with UC Davis.**

## Install

- **[Chrome Web Store → ass.vijit.app](https://ass.vijit.app)** — official build by [Vijit Dua](https://vijitdua.com)
- **From source** — clone this repo, check out the `releases` branch, then Chrome → Extensions → Developer mode → **Load unpacked** → select the repo folder

## How it works

1. Open Schedule Builder on `my.ucdavis.edu` or `schedulebuilder.ucdavis.edu`.
2. A floating **Aggie Sniper ⚙** bar appears near your pass times.
3. Click it to open settings, including the Advanced Planner toggle.
4. On first visit, a short onboarding modal explains how the app works (stay awake, keep the tab open, stay online).

### Advanced Planner

Open **Advanced Planner** from the popup, or beside Schedule Builder's course search. It finds the perfect schedule for you based on your preferences across all combinations of courses.

1. Type the courses you want (e.g. `CHE 002A`) and hit **Continue**.
2. Slide how much you like each time of day, then each weekday, then whether class times or professor ratings matter more.
3. Ranked options show live seats, professor ratings, and a week calendar. Click a course or its **Select** button to choose that section, or click the combination’s **Select Bundle** button to choose every section at once. Clicking the bundle background or calendar does not select courses. Courses and bundles stay visible as you select multiple courses or deselect a section. Selecting a different section of the same course replaces its previous selection; selecting a bundle fills the complete schedule. Selected times stay greyed on other calendars so you can see how the next choice fits.
4. When every course is selected, **Save** writes them into Schedule Builder — replacing only an unregistered section of the same course, and skipping any course that's already registered or waitlisted.

For consecutive meetings on the same day with a gap of 0–30 minutes, Schedule Builder's **list view** shows a compact travel note directly beneath the destination course's header, outside its collapsed details. Advanced Planner cards and the selected schedule show only tight transfers (less than 3 minutes spare for either travel mode). Notes use **Walk ~X min · Bike ~Y min** with a short status; same-building transfers show a room-change estimate. Repeated course pairs across weekdays are combined. There is no banner above the schedule, and no travel note is injected into the native calendar view. Unknown locations show “travel time unavailable” in the course list and are omitted from Planner warnings because tightness cannot be calculated.

Estimates run offline with no API key or runtime network requests. The model uses bundled [UC Davis GIS building footprints](https://gis.ucdavis.edu/server/rest/services/Community_Basemap_Buildings2/MapServer/0) (snapshot: October 3, 2026; cleaned: October 9, 2026), bounding-box centers, straight-line distance × 1.3, assumed speeds of 4.8 km/h walking and 12 km/h cycling, and buffers of 2 and 4 minutes respectively. Same-building room changes use 2 minutes for both modes. The cleaned dataset averages duplicate footprint centers for each named building and combines its aliases, removes blank/truncated names and clearly unrelated utility/storage/apartment records, and keeps independently numbered teaching buildings, laboratories and field facilities distinct. These are rough estimates, not measured routes; entrances, stairs, construction, traffic, and bicycle restrictions are not modeled. Refresh the snapshot as campus buildings change.

Preferences rank options; they never hard-filter them out. If no perfect schedule exists — overlapping classes, no open seats, a clash with something else you already saved — you still get the closest options, with a banner saying exactly what had to give.

## Branches

| Branch | Use |
|--------|-----|
| `releases` | Production line; tagged store builds |
| `develop` | Integration; **send PRs here** |

## Contributing

Listed on [vijitdua.com/open-source](https://vijitdua.com/open-source). See [CONTRIBUTING.md](CONTRIBUTING.md).

| Need | Where |
|------|--------|
| Bug / feature (repo work) | GitHub issues — include **debug logs** from popup **⚙️ Copy debug logs** when reporting bugs |
| Personal help / feedback | [support](https://vijitdua.com/support/ass) |
| Security | [Security policy](https://vijitdua.com/open-source/security) |
| Templates | [Issue](https://vijitdua.com/open-source/contributing?template=issue) · [PR](https://vijitdua.com/open-source/contributing?template=pr) |

## Testing

Append to a Schedule Builder URL:

- `?ucdTest=30` — simulated pass in 30 seconds
- `#ucdTest=30` — same via hash
- `?assReset=1` — show the first-run welcome modal again (also works as `#assReset=1`)

## Forks and derivatives

This project is [MIT licensed](LICENSE). If you ship a modified build, you **must** rebrand — see [TRADEMARK.md](TRADEMARK.md) and replace [`branding/official.js`](branding/official.js).

## Docs

- [CHANGELOG.md](CHANGELOG.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Links

- Extension: https://ass.vijit.app
- Author: https://vijitdua.com
- Support: https://vijitdua.com/support/ass
- Contribute: https://vijitdua.com/open-source/contributing
- Security: https://vijitdua.com/open-source/security
