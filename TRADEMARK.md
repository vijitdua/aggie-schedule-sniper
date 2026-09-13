# Trademark and branding policy

The MIT License grants rights to the **source code**. It does **not** grant rights to use the **Aggie Schedule Sniper** name, logo, or official author branding in a way that suggests endorsement by Vijit Dua or the upstream project.

## Official builds

Official Chrome Web Store builds ([ass.vijit.app](https://ass.vijit.app)) and releases from this repository’s `releases` branch may use the branding defined in [`branding/official.js`](branding/official.js).

## Forks and modified distributions

If you **distribute** a modified version, you **must**:

1. Change `manifest.json` fields such as `name`, `short_name`, `description`, `author`, and `homepage_url`.
2. Replace [`branding/official.js`](branding/official.js) with your own branding (footer links, share URL, debug prefix).
3. Remove or replace the “By Vijit Dua” footer and any links to vijitdua.com / vijit.app in the UI.
4. Use your own extension icon if the current icon could imply an official build.
5. State clearly in your listing or README that your build is **unofficial** and not affiliated with Vijit Dua or UC Davis.

Failure to rebrand may confuse users into thinking your fork is the official extension.
