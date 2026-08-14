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

Chrome extension for UC Davis students using Schedule Builder. Builds conflict-free course plans with professor ratings and live seat status, watches your pass time, shows a countdown, and clicks Register ALL automatically when your registration window opens.

**Not affiliated with UC Davis.**

## Install

- **[Chrome Web Store → ass.vijit.app](https://ass.vijit.app)** — official build by [Vijit Dua](https://vijitdua.com)
- **From source** — clone this repo, check out the `releases` branch, then Chrome → Extensions → Developer mode → **Load unpacked** → select the repo folder

## How it works

1. Open Schedule Builder on `my.ucdavis.edu` or `schedulebuilder.ucdavis.edu`.
2. A floating **Aggie Sniper ⚙** bar appears near your pass times.
3. Click it to open settings, including the Smart Schedule Planner visibility toggle.
4. On first visit, a short onboarding modal explains how the app works (stay awake, keep the tab open, stay online).

### Smart schedule planner

1. Open **Smart Planner** next to **Export Calendar** in the extension popup, or next to the native course-search button on Schedule Builder.
2. Type a course such as `CHE 002A`, choose a real Schedule Builder match, and add it as a chip. Invalid courses cannot be added.
3. Search all selected courses and load live Open/Waitlist status plus RateMyProfessors data.
4. Open **Advanced Settings** to choose preferred weekdays and mark time blocks as Preferred, Neutral, Less preferred, or Never.
5. Pick one professor per course, or use **Time Priority** or **Rating Priority**. Each automatic mode gives its named factor the larger weight while still considering the other factor.
6. Review the conflict-free result, then optionally save those sections to the current Schedule Builder schedule.
7. Use **Copy GPT scheduling prompt** to copy a plain-text section dataset and preferences for ChatGPT. The extension does not call an AI API or send the schedule anywhere.

Sections showing `Open 0 / Waitlist 0`, conflicts with your current Schedule, or overlap with a Never time block are excluded. Waitlist-only and TBA results remain visibly flagged and require user review.

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
