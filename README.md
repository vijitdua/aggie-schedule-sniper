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
3. Ranked options show live seats, professor ratings, and a week calendar. Select one section at a time into your selected schedule; remaining options only show what's left to choose. Selected times stay greyed on other calendars so you can see how the next pick fits.
4. When every course is selected, **Save** writes them into Schedule Builder — replacing only an unregistered section of the same course, and skipping any course that's already registered or waitlisted.

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
