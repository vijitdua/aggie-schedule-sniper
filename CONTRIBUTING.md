# Contributing to Aggie Schedule Sniper

Official extension: **[ass.vijit.app](https://ass.vijit.app)** · Author: **[vijitdua.com](https://vijitdua.com)**

Thank you for your interest in contributing.

Canonical policy (templates, expectations, when to use GitHub):

- [Contributing · Open Source](https://vijitdua.com/open-source/contributing)
- [Issue template (copy/paste)](https://vijitdua.com/open-source/contributing?template=issue)
- [PR template (copy/paste)](https://vijitdua.com/open-source/contributing?template=pr)

## TL;DR

- This project is listed on [/open-source](https://vijitdua.com/open-source).
- **Bug or feature for the repo?** Open a GitHub issue (or PR). Use the templates here or on the site.
- **Not contributing code?** Personal help, “this feels off,” account questions → [support](https://vijitdua.com/support), not GitHub.
- **Security issue?** [Security policy](https://vijitdua.com/open-source/security). Serious issues: contact privately before posting details publicly.
- Keep PRs small. Prefer branch/title like `42-short-name` when an issue exists.
- Read [LICENSE](LICENSE). Major work may appear on [/contributions](https://vijitdua.com/contributions) at my discretion.

## This repository

| Branch | Purpose |
|--------|---------|
| `develop` | Integration — **open PRs here** |
| `releases` | Production / Chrome Web Store — merge via `release/*` branches |

1. Fork, branch from `develop`.
2. One logical change per PR.
3. Forks that ship modified builds must rebrand — [TRADEMARK.md](TRADEMARK.md), [`branding/official.js`](branding/official.js).

## Reporting bugs

GitHub bug reports should include reproduction steps and, when possible, **debug logs**:

1. Reproduce on Schedule Builder (`my.ucdavis.edu` or `schedulebuilder.ucdavis.edu`).
2. Open the extension popup or **Aggie Sniper ⚙** on the page.
3. Click **⚙️ Copy debug logs** in the footer and paste into the issue.

The [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) has a field for this.

## Local development

1. Clone and check out `develop`.
2. Chrome → Extensions → Developer mode → **Load unpacked** → repo root.
3. Optional URL helpers on Schedule Builder:
   - `?ucdTest=30` — simulated pass in 30 seconds
   - `?assReset=1` — show first-run onboarding again

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Expectations

I maintain open source in my spare time. I may not respond to non-critical issues or PRs immediately — thank you for your patience.

If you care how you are credited on [vijitdua.com/contributions](https://vijitdua.com/contributions) for significant work, add links in the PR **Credit** section; otherwise I use your GitHub username.
