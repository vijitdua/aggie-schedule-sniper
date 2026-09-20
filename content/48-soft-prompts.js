(() => {
  const ASS = window.ASS;
  const { config, ui, api } = ASS;

  const CARD_STYLE = [
    "max-width:392px",
    "width:100%",
    "background:#fff",
    "border-radius:16px",
    "padding:22px 24px 20px",
    "position:relative",
    "box-shadow:0 24px 48px rgba(0,0,0,.22)",
    "font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "color:#01256e",
    "text-align:center",
    "box-sizing:border-box",
  ].join(";");

  const STORAGE = {
    feedbackSettled: "assFeedbackSettled",
    feedbackSnoozeUntil: "assFeedbackSnoozeUntil",
    feedbackNotNowCount: "assFeedbackNotNowCount",
    whatsNewSeenId: "assWhatsNewSeenId",
    lastSeenManifestVersion: "assLastSeenManifestVersion",
  };

  const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
  const MAX_NOT_NOW = 3;
  const STYLE_ID = "ass-soft-prompt-styles-v3";

  function getEntries() {
    return Array.isArray(window.ASS_WHATS_NEW_ENTRIES)
      ? window.ASS_WHATS_NEW_ENTRIES
      : [];
  }

  function getManifestVersion() {
    try {
      return chrome.runtime.getManifest?.()?.version || "";
    } catch {
      return "";
    }
  }

  function latestEntryId() {
    return getEntries()[0]?.id || "";
  }

  function markWhatsNewSeenPayload() {
    const payload = {
      [STORAGE.lastSeenManifestVersion]: getManifestVersion(),
    };
    const latestId = latestEntryId();
    if (latestId) {
      payload[STORAGE.whatsNewSeenId] = latestId;
    }
    return payload;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ass-soft-primary-btn {
        width: 100%;
        height: 38px;
        border: none;
        border-radius: 10px;
        background: #ffbf00;
        color: #01256e;
        font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: pointer;
      }
      .ass-soft-outline-btn {
        width: 100%;
        height: 38px;
        border: 1px solid #dce2ea;
        border-radius: 10px;
        background: #fff;
        color: #01256e;
        font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: pointer;
      }
      .ass-soft-outline-btn:hover {
        border-color: #94a3b8;
      }
      .ass-soft-outline-btn.is-copied {
        border-color: #01256e;
        background: #f8fafc;
      }
      .ass-soft-toast {
        margin: 0 0 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #01256e;
        color: #fff;
        font: 500 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: left;
      }
      .ass-soft-toast[hidden] {
        display: none !important;
      }
      .ass-soft-toast--error {
        background: #b91c1c;
      }
      .ass-soft-text-btn {
        display: inline-block;
        margin-top: 8px;
        padding: 0;
        border: none;
        background: none;
        color: #64748b;
        font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: pointer;
        text-decoration: none;
      }
      .ass-soft-text-btn:hover {
        text-decoration: underline;
        color: #01256e;
      }
      .ass-soft-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        margin-top: 4px;
      }
      .ass-soft-title {
        margin: 0 0 14px;
        font-size: 17px;
        font-weight: 600;
        line-height: 1.35;
        letter-spacing: -0.01em;
        color: #01256e;
      }
      .ass-soft-title--tight {
        margin-bottom: 10px;
      }
      .ass-soft-body {
        margin: 0 0 12px;
        font-size: 13px;
        line-height: 1.5;
        color: #475569;
        text-align: left;
        font-weight: 400;
      }
      .ass-soft-body p {
        margin: 0 0 8px;
      }
      .ass-soft-body p:last-child {
        margin-bottom: 0;
      }
      .ass-soft-link {
        color: #01256e;
        font-weight: 500;
        text-decoration: underline;
      }
      .ass-soft-card--scroll {
        max-width: 480px;
        max-height: min(88vh, 780px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        text-align: left;
        padding-top: 18px;
        padding-bottom: 16px;
      }
      .ass-soft-updates-header {
        flex: 0 0 auto;
        text-align: center;
        margin-bottom: 12px;
      }
      .ass-soft-updates-header .ass-soft-title {
        margin-bottom: 4px;
      }
      .ass-soft-updates-scroll {
        flex: 1 1 auto;
        overflow: auto;
        min-height: 0;
        padding-right: 2px;
        margin: 0 0 12px;
      }
      .ass-soft-updates-footer {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ass-soft-backdrop--top {
        align-items: flex-start !important;
        padding-top: max(24px, 5vh) !important;
      }
      .ass-soft-updates-block {
        margin: 0 0 16px;
      }
      .ass-soft-updates-block:last-child {
        margin-bottom: 4px;
      }
      .ass-soft-updates-heading {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: #01256e;
        text-align: left;
      }
      .ass-soft-updates-subhead {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.4;
        color: #64748b;
        text-align: left;
      }
      .ass-soft-release {
        margin: 0 0 8px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .ass-soft-release > summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        color: #01256e;
        background: #f8fafc;
        text-align: left;
      }
      .ass-soft-release > summary::-webkit-details-marker {
        display: none;
      }
      .ass-soft-release > summary::before {
        content: "▸";
        flex: 0 0 auto;
        margin-top: 1px;
        color: #94a3b8;
        font-weight: 500;
      }
      .ass-soft-release[open] > summary::before {
        content: "▾";
      }
      .ass-soft-release-body {
        padding: 4px 12px 12px;
        text-align: left;
      }
      .ass-soft-release-meta {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 500;
        color: #64748b;
        text-align: left;
      }
      .ass-soft-release-section {
        margin: 12px 0 0;
        text-align: left;
      }
      .ass-soft-release-section-title {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.3;
        color: #01256e;
        text-align: left;
      }
      .ass-soft-release-section .ass-soft-release-section-title.ass-soft-release-subsection {
        margin-top: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #334155;
      }
      .ass-soft-release ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .ass-soft-changelog-details {
        margin-top: 10px;
        border: none;
        border-radius: 8px;
        background: #f8fafc;
      }
      .ass-soft-changelog-details > summary {
        list-style: none;
        cursor: pointer;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        text-align: left;
      }
      .ass-soft-changelog-details > summary::-webkit-details-marker {
        display: none;
      }
      .ass-soft-changelog-details > summary::before {
        content: "▸ ";
        color: #94a3b8;
      }
      .ass-soft-changelog-details[open] > summary::before {
        content: "▾ ";
      }
      .ass-soft-changelog-details-body {
        padding: 0 10px 10px;
      }
      .ass-soft-muted {
        margin: 0;
        font-size: 12px;
        color: #94a3b8;
        text-align: left;
      }
    `;
    document.head.appendChild(style);
  }

  function createLogo() {
    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("128.png");
    logo.alt = "Aggie Schedule Sniper";
    logo.style.cssText =
      "display:block;width:40px;height:40px;margin:0 auto 10px;border-radius:10px;object-fit:cover;";
    return logo;
  }

  function createTitle(text, { tight = false } = {}) {
    const title = document.createElement("h2");
    title.className = tight ? "ass-soft-title ass-soft-title--tight" : "ass-soft-title";
    title.textContent = text;
    return title;
  }

  function createBackdrop() {
    return api.createStyledElement(
      "div",
      [
        "position:fixed",
        "inset:0",
        "background:rgba(0,0,0,.65)",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:20px",
        "box-sizing:border-box",
      ].join(";"),
    );
  }

  function createPrimaryButton(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ass-soft-primary-btn";
    btn.textContent = label;
    return btn;
  }

  function createOutlineButton(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ass-soft-outline-btn";
    btn.textContent = label;
    return btn;
  }

  function createTextButton(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ass-soft-text-btn";
    btn.textContent = label;
    return btn;
  }

  function listItem(text) {
    const li = api.createStyledElement(
      "li",
      "margin:0 0 10px;padding-left:20px;position:relative;line-height:1.45;text-align:left;color:#334155;",
    );
    li.appendChild(
      api.createStyledElement(
        "span",
        "position:absolute;left:0;top:0.45em;width:8px;height:8px;border-radius:50%;background:#ffbf00;",
      ),
    );
    li.append(text);
    return li;
  }

  function isBlockingModalOpen() {
    return !!(ui.onboardingRoot || ui.softPromptRoot);
  }

  function closeSoftPrompt() {
    if (ui.softPromptRoot) {
      ui.softPromptRoot.remove();
      ui.softPromptRoot = null;
    }
  }

  function openSoftCard(buildCard, { onBackdrop, pinTop = false } = {}) {
    if (window.self !== window.top || isBlockingModalOpen()) {
      return false;
    }
    api.closeSettingsPanel?.();
    ensureStyles();
    const backdrop = createBackdrop();
    if (pinTop) {
      backdrop.classList.add("ass-soft-backdrop--top");
    }
    const card = api.createStyledElement("div", CARD_STYLE);
    buildCard(card, backdrop);
    backdrop.appendChild(card);
    if (onBackdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          onBackdrop();
        }
      });
    }
    document.body.appendChild(backdrop);
    ui.softPromptRoot = backdrop;
    return true;
  }

  function parseVersionParts(version) {
    return String(version || "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  }

  function appendVersionWithBump(container, fromVersion, toVersion) {
    const fromParts = parseVersionParts(fromVersion);
    const toParts = parseVersionParts(toVersion);
    let bumpIndex = -1;
    const maxLen = Math.max(fromParts.length, toParts.length, 3);
    for (let i = 0; i < maxLen; i += 1) {
      if ((fromParts[i] || 0) !== (toParts[i] || 0)) {
        bumpIndex = i;
        break;
      }
    }

    container.append(`v${fromVersion} → v`);
    const toSegments = String(toVersion).split(".");
    toSegments.forEach((seg, i) => {
      if (i > 0) {
        container.append(".");
      }
      if (i === bumpIndex) {
        const bold = document.createElement("strong");
        bold.textContent = seg;
        bold.style.fontWeight = "700";
        bold.style.textDecoration = "underline";
        container.appendChild(bold);
      } else {
        container.append(seg);
      }
    });
  }

  function formatShortDate(isoDate) {
    if (!isoDate) {
      return "";
    }
    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const CHANGELOG_GITHUB =
    "https://github.com/vijitdua/aggie-schedule-sniper/blob/releases/CHANGELOG.md";

  async function loadChangelogReleases() {
    const parse = globalThis.ASS_CHANGELOG?.parseChangelog;
    if (typeof parse !== "function") {
      throw new Error("Changelog parser missing");
    }
    const url = chrome.runtime.getURL("CHANGELOG.md");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load CHANGELOG.md (${response.status})`);
    }
    return parse(await response.text());
  }

  function appendChangelogSections(container, release) {
    if (!release?.sections?.length) {
      const empty = document.createElement("p");
      empty.className = "ass-soft-muted";
      empty.textContent = "No detailed notes for this version.";
      container.appendChild(empty);
      return;
    }
    for (const section of release.sections) {
      const wrap = document.createElement("div");
      wrap.className = "ass-soft-release-section";
      const heading = document.createElement("p");
      heading.className =
        "ass-soft-release-section-title ass-soft-release-subsection";
      heading.textContent = section.heading;
      const ul = document.createElement("ul");
      for (const bullet of section.bullets) {
        ul.appendChild(listItem(bullet));
      }
      wrap.append(heading, ul);
      container.appendChild(wrap);
    }
  }

  function buildReleaseDetails({
    version,
    title,
    meta,
    open = false,
    fillBody,
  }) {
    const details = document.createElement("details");
    details.className = "ass-soft-release";
    if (version) {
      details.dataset.version = version;
    }
    details.open = !!open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const body = document.createElement("div");
    body.className = "ass-soft-release-body";
    if (meta) {
      const metaEl = document.createElement("p");
      metaEl.className = "ass-soft-release-meta";
      metaEl.textContent = meta;
      body.appendChild(metaEl);
    }
    fillBody(body);
    details.append(summary, body);
    return details;
  }

  async function renderUpdatesHistory({
    focusVersion = "",
    markSeen = false,
    source = "updates",
  } = {}) {
    let changelogReleases = [];
    let changelogError = "";
    try {
      changelogReleases = await loadChangelogReleases();
    } catch (error) {
      changelogError = error?.message || "Could not load changelog";
    }

    const entriesByVersion = new Map(
      getEntries().map((entry) => [entry.version, entry]),
    );
    const focus = focusVersion || "";

    softLog("[updates_history]", {
      action: "show",
      source,
      focusVersion: focus || null,
      whatsNewCount: entriesByVersion.size,
      changelogCount: changelogReleases.length,
      changelogError: changelogError || null,
    });

    const opened = openSoftCard(
      (card) => {
        card.classList.add("ass-soft-card--scroll");
        card.style.maxWidth = "480px";
        card.style.maxHeight = "min(88vh, 780px)";
        card.style.paddingTop = "18px";
        card.style.paddingBottom = "16px";

        const header = document.createElement("div");
        header.className = "ass-soft-updates-header";
        const title = createTitle("Updates", { tight: true });
        const tagline = api.createStyledElement(
          "p",
          "margin:0 0 2px;font-size:13px;font-weight:500;color:#51627d;text-align:center;",
          "ass.vijit.app",
        );
        const meta = api.createStyledElement(
          "p",
          "margin:0;font-size:12px;font-weight:500;color:#51627d;text-align:center;",
          getManifestVersion() ? `v${getManifestVersion()}` : "",
        );
        header.append(createLogo(), title, tagline, meta);

        const scroll = document.createElement("div");
        scroll.className = "ass-soft-updates-scroll";

        if (changelogError) {
          scroll.appendChild(
            Object.assign(document.createElement("p"), {
              className: "ass-soft-muted",
              textContent: changelogError,
            }),
          );
        } else if (!changelogReleases.length) {
          scroll.appendChild(
            Object.assign(document.createElement("p"), {
              className: "ass-soft-muted",
              textContent: "No changelog entries found.",
            }),
          );
        }

        for (const release of changelogReleases) {
          const entry = entriesByVersion.get(release.version);
          const dateLabel =
            formatShortDate(entry?.date || release.date) ||
            release.date ||
            "";
          const titleText = dateLabel
            ? `v${release.version} · ${dateLabel}`
            : `v${release.version}`;

          scroll.appendChild(
            buildReleaseDetails({
              version: release.version,
              title: titleText,
              open: release.version === focus,
              fillBody: (body) => {
                const userSection = document.createElement("div");
                userSection.className = "ass-soft-release-section";
                userSection.appendChild(
                  Object.assign(document.createElement("p"), {
                    className: "ass-soft-release-section-title",
                    textContent: "User Facing Notes",
                  }),
                );
                if (entry?.bullets?.length || entry?.headline) {
                  if (entry.headline) {
                    userSection.appendChild(
                      Object.assign(document.createElement("p"), {
                        className: "ass-soft-release-meta",
                        textContent: entry.headline,
                      }),
                    );
                  }
                  const list = document.createElement("ul");
                  (entry.bullets || []).forEach((bullet) => {
                    list.appendChild(listItem(bullet));
                  });
                  userSection.appendChild(list);
                } else {
                  userSection.appendChild(
                    Object.assign(document.createElement("p"), {
                      className: "ass-soft-muted",
                      textContent: "No user-facing notes for this version.",
                    }),
                  );
                }
                body.appendChild(userSection);

                const devSection = document.createElement("div");
                devSection.className = "ass-soft-release-section";
                devSection.appendChild(
                  Object.assign(document.createElement("p"), {
                    className: "ass-soft-release-section-title",
                    textContent: "Internal Developer Notes",
                  }),
                );
                appendChangelogSections(devSection, release);
                body.appendChild(devSection);
              },
            }),
          );
        }

        const footer = document.createElement("div");
        footer.className = "ass-soft-updates-footer";
        const links = document.createElement("p");
        links.style.cssText =
          "margin:0;font-size:12px;text-align:center;color:#51627d;";
        const gh = document.createElement("a");
        gh.href = CHANGELOG_GITHUB;
        gh.target = "_blank";
        gh.rel = "noopener noreferrer";
        gh.className = "ass-soft-link";
        gh.textContent = "CHANGELOG.md on GitHub";
        links.appendChild(gh);

        const gotIt = createPrimaryButton("Got it");
        gotIt.addEventListener("click", () => {
          softLog("[updates_history]", {
            action: "got_it",
            source,
            markSeen: !!markSeen,
          });
          if (markSeen) {
            void markWhatsNewSeen().then(closeSoftPrompt);
          } else {
            closeSoftPrompt();
          }
        });
        footer.append(links, gotIt);

        card.append(header, scroll, footer);
      },
      {
        pinTop: true,
        onBackdrop: () => {
          softLog("[updates_history]", {
            action: "backdrop",
            source,
            markSeen: !!markSeen,
          });
          if (markSeen) {
            void markWhatsNewSeen().then(closeSoftPrompt);
          } else {
            closeSoftPrompt();
          }
        },
      },
    );

    return opened;
  }

  function getUnseenEntries(seenId) {
    const entries = getEntries();
    if (!entries.length) {
      return [];
    }
    if (!seenId) {
      return entries;
    }
    const idx = entries.findIndex((entry) => entry.id === seenId);
    if (idx === -1) {
      return entries.slice(0, 1);
    }
    return entries.slice(0, idx);
  }

  async function copyShareMessage() {
    const text =
      ASS.branding.shareMessage ||
      `Check out ${
        ASS.branding.shareUrl || "https://ass.vijit.app"
      }/ — it's a Schedule Builder Chrome extension for UC Davis students. Auto-registers at your pass time, exports your calendar, shows RateMyProfessors ratings right in Schedule Builder, and helps you pick the best schedule for yourself among all possible combinations of your courses!`;
    if (window.ASS_CLIPBOARD) {
      return window.ASS_CLIPBOARD.copyText(text);
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    });
  }

  function storageSet(payload) {
    return new Promise((resolve) => {
      chrome.storage.local.set(payload, () => resolve());
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => resolve());
    });
  }

  async function clearWhatsNewState() {
    await storageRemove([
      STORAGE.whatsNewSeenId,
      STORAGE.lastSeenManifestVersion,
    ]);
  }

  async function clearFeedbackState() {
    await storageRemove([
      STORAGE.feedbackSettled,
      STORAGE.feedbackSnoozeUntil,
      STORAGE.feedbackNotNowCount,
    ]);
  }

  async function markWhatsNewSeen() {
    const payload = markWhatsNewSeenPayload();
    await storageSet(payload);
    softLog("[whats_new]", {
      action: "mark_seen",
      seenId: payload[STORAGE.whatsNewSeenId] || "",
      manifestVersion: payload[STORAGE.lastSeenManifestVersion] || "",
    });
  }

  async function getFeedbackEligibility() {
    const result = await storageGet([
      STORAGE.feedbackSettled,
      STORAGE.feedbackSnoozeUntil,
      STORAGE.feedbackNotNowCount,
    ]);
    const notNowCount = Number(result[STORAGE.feedbackNotNowCount] || 0);
    const snoozeUntil = Number(result[STORAGE.feedbackSnoozeUntil] || 0);
    if (result[STORAGE.feedbackSettled]) {
      return {
        eligible: false,
        skipReason: "settled",
        notNowCount,
        snoozeUntil,
      };
    }
    if (notNowCount >= MAX_NOT_NOW) {
      return {
        eligible: false,
        skipReason: "max_not_now",
        notNowCount,
        snoozeUntil,
      };
    }
    if (snoozeUntil && Date.now() < snoozeUntil) {
      return {
        eligible: false,
        skipReason: "snoozed",
        notNowCount,
        snoozeUntil,
        snoozeRemainingMs: snoozeUntil - Date.now(),
      };
    }
    return { eligible: true, notNowCount, snoozeUntil };
  }

  async function isFeedbackEligible() {
    return (await getFeedbackEligibility()).eligible;
  }

  async function settleFeedback(source) {
    await storageSet({
      [STORAGE.feedbackSettled]: true,
      [STORAGE.feedbackSnoozeUntil]: 0,
    });
    softLog("[feedback_prompt]", {
      action: "settle",
      source: source || "unknown",
    });
  }

  async function snoozeFeedback(source) {
    const result = await storageGet([STORAGE.feedbackNotNowCount]);
    const nextCount = Number(result[STORAGE.feedbackNotNowCount] || 0) + 1;
    if (nextCount >= MAX_NOT_NOW) {
      await storageSet({
        [STORAGE.feedbackSettled]: true,
        [STORAGE.feedbackNotNowCount]: nextCount,
        [STORAGE.feedbackSnoozeUntil]: 0,
      });
      softLog("[feedback_prompt]", {
        action: "settle",
        source: source || "max_not_now",
        notNowCount: nextCount,
      });
      return { settledForever: true, notNowCount: nextCount };
    }
    const snoozeUntil = Date.now() + SNOOZE_MS;
    await storageSet({
      [STORAGE.feedbackNotNowCount]: nextCount,
      [STORAGE.feedbackSnoozeUntil]: snoozeUntil,
    });
    softLog("[feedback_prompt]", {
      action: "snooze",
      source: source || "not_now",
      notNowCount: nextCount,
      snoozeUntil,
    });
    return { settledForever: false, notNowCount: nextCount, snoozeUntil };
  }

  function softLog(event, detail) {
    api.snipeLog?.(event, detail);
  }

  function renderFeedbackAsk(options = {}) {
    softLog("[feedback_prompt]", {
      action: "render_ask",
      reason: options.reason || "unknown",
    });
    openSoftCard(
      (card) => {
        const title = createTitle("Was ass.vijit.app helpful?");
        const stack = document.createElement("div");
        stack.className = "ass-soft-stack";

        const helpedBtn = createPrimaryButton("It helped");
        const notReallyBtn = createOutlineButton("Not really");
        const notNowBtn = createTextButton("Not now");

        helpedBtn.addEventListener("click", () => {
          softLog("[feedback_prompt]", { action: "answer", choice: "helped" });
          void settleFeedback("helped").then(() => {
            closeSoftPrompt();
            renderFeedbackPositive();
          });
        });
        notReallyBtn.addEventListener("click", () => {
          softLog("[feedback_prompt]", {
            action: "answer",
            choice: "not_really",
          });
          void settleFeedback("not_really").then(() => {
            closeSoftPrompt();
            renderFeedbackNegative();
          });
        });
        notNowBtn.addEventListener("click", () => {
          softLog("[feedback_prompt]", { action: "answer", choice: "not_now" });
          void snoozeFeedback("not_now").then(closeSoftPrompt);
        });

        stack.append(helpedBtn, notReallyBtn, notNowBtn);
        card.append(createLogo(), title, stack);
      },
      {
        onBackdrop: () => {
          softLog("[feedback_prompt]", {
            action: "answer",
            choice: "backdrop",
          });
          void snoozeFeedback("backdrop").then(closeSoftPrompt);
        },
      },
    );
  }

  function renderFeedbackPositive() {
    softLog("[feedback_prompt]", { action: "render_positive" });
    openSoftCard((card) => {
      const title = createTitle("Thank you. That means a lot.", { tight: true });

      const body = document.createElement("div");
      body.className = "ass-soft-body";

      const ask = document.createElement("p");
      ask.textContent =
        "It would mean the world if you left a review or shared this with friends.";

      const credit = document.createElement("p");
      const nameLink = document.createElement("a");
      nameLink.href = ASS.branding.authorUrl || "https://vijitdua.com";
      nameLink.target = "_blank";
      nameLink.rel = "noopener noreferrer";
      nameLink.className = "ass-soft-link";
      nameLink.textContent = "Vijit Dua";
      const contribLink = document.createElement("a");
      contribLink.href =
        ASS.branding.contributeUrl || "https://vijitdua.com/open-source";
      contribLink.target = "_blank";
      contribLink.rel = "noopener noreferrer";
      contribLink.className = "ass-soft-link";
      contribLink.textContent = "contributors";
      credit.append(
        "Aggie Schedule Sniper is built for free & maintained by ",
        nameLink,
        " and other student ",
        contribLink,
        ". We do not track you, sell your data, or make money from this.",
      );

      body.append(ask, credit);

      const stack = document.createElement("div");
      stack.className = "ass-soft-stack";

      const reviewBtn = createPrimaryButton("Leave a review");
      const shareBtn = createOutlineButton("Copy invite for friends");
      const doneBtn = createTextButton("Done");

      const toast = document.createElement("div");
      toast.className = "ass-soft-toast";
      toast.hidden = true;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      let toastTimer = 0;
      let shareLabelTimer = 0;
      const showToast = (message, kind) => {
        toast.textContent = message;
        toast.classList.toggle("ass-soft-toast--error", kind === "error");
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          toast.hidden = true;
        }, 4000);
      };

      reviewBtn.addEventListener("click", () => {
        softLog("[feedback_prompt]", { action: "leave_review" });
        const url =
          ASS.branding.reviewsUrl ||
          ASS.branding.shareUrl ||
          "https://ass.vijit.app";
        window.open(url, "_blank", "noopener,noreferrer");
        closeSoftPrompt();
      });
      shareBtn.addEventListener("click", () => {
        void copyShareMessage().then((copied) => {
          softLog("[feedback_prompt]", {
            action: "share_copy",
            ok: !!copied,
          });
          if (!copied) {
            showToast("Couldn't copy — check clipboard permission", "error");
            return;
          }
          clearTimeout(shareLabelTimer);
          shareBtn.classList.add("is-copied");
          shareBtn.textContent = "Copied!";
          showToast("Invite copied — paste it in a chat with friends");
          shareLabelTimer = window.setTimeout(() => {
            shareBtn.classList.remove("is-copied");
            shareBtn.textContent = "Copy invite for friends";
          }, 2500);
        });
      });
      doneBtn.addEventListener("click", () => {
        softLog("[feedback_prompt]", { action: "done", path: "positive" });
        closeSoftPrompt();
      });

      stack.append(reviewBtn, shareBtn, doneBtn);
      card.append(createLogo(), title, body, toast, stack);
    });
  }

  function renderFeedbackNegative() {
    softLog("[feedback_prompt]", { action: "render_negative" });
    openSoftCard((card) => {
      const title = createTitle(
        "Sorry to hear that your experience with ass.vijit.app was not the best.",
        { tight: true },
      );

      const body = document.createElement("div");
      body.className = "ass-soft-body";
      const p = document.createElement("p");
      p.textContent =
        "We would love your feedback so we can improve it for you and for other students.";
      body.appendChild(p);

      const stack = document.createElement("div");
      stack.className = "ass-soft-stack";

      const sendBtn = createPrimaryButton("Send feedback");
      const noThanksBtn = createTextButton("No thanks");

      sendBtn.addEventListener("click", () => {
        softLog("[feedback_prompt]", { action: "send_feedback" });
        const url =
          ASS.branding.supportUrl || "https://vijitdua.com/support/ass";
        window.open(url, "_blank", "noopener,noreferrer");
        closeSoftPrompt();
      });
      noThanksBtn.addEventListener("click", () => {
        softLog("[feedback_prompt]", { action: "no_thanks" });
        closeSoftPrompt();
      });

      stack.append(sendBtn, noThanksBtn);
      card.append(createLogo(), title, body, stack);
    });
  }

  async function maybeShowFeedbackPrompt(options = {}) {
    const reason = options.reason || "unknown";
    if (window.self !== window.top) {
      softLog("[feedback_prompt]", {
        action: "skip",
        reason,
        skipReason: "iframe",
      });
      return;
    }
    if (isBlockingModalOpen()) {
      softLog("[feedback_prompt]", {
        action: "skip",
        reason,
        skipReason: "blocking_modal",
      });
      return;
    }
    const eligibility = await getFeedbackEligibility();
    if (!eligibility.eligible) {
      softLog("[feedback_prompt]", {
        action: "skip",
        reason,
        skipReason: eligibility.skipReason,
        notNowCount: eligibility.notNowCount,
        snoozeUntil: eligibility.snoozeUntil || 0,
        snoozeRemainingMs: eligibility.snoozeRemainingMs || 0,
      });
      return;
    }
    softLog("[feedback_prompt]", {
      action: "show",
      reason,
      notNowCount: eligibility.notNowCount,
    });
    renderFeedbackAsk({ reason });
  }

  function renderWhatsNew(entry, { multiJump, fromVersion, toVersion }) {
    openSoftCard((card) => {
      const title = createTitle("Aggie Schedule Sniper", {
        tight: true,
      });
      const tagline = api.createStyledElement(
        "p",
        "margin:0 0 4px;font-size:13px;font-weight:500;color:#51627d;",
        "ass.vijit.app",
      );

      const meta = api.createStyledElement(
        "p",
        "margin:0 0 14px;font-size:12px;font-weight:500;color:#51627d;",
      );
      const dateLabel = formatShortDate(entry.date);
      if (fromVersion && toVersion && fromVersion !== toVersion) {
        meta.append("updated • ");
        appendVersionWithBump(meta, fromVersion, toVersion);
        if (dateLabel) {
          meta.append(` • ${dateLabel}`);
        }
      } else {
        const ver = toVersion || entry.version;
        meta.textContent = dateLabel
          ? `updated • v${ver} • ${dateLabel}`
          : `updated • v${ver}`;
      }

      const section = api.createStyledElement(
        "p",
        "margin:0 0 6px;font-size:14px;font-weight:600;color:#01256e;text-align:left;",
        "What's New?",
      );

      const list = api.createStyledElement(
        "ul",
        "margin:0 auto 14px;padding:0;list-style:none;max-width:348px;",
      );
      if (entry.headline) {
        list.appendChild(
          api.createStyledElement(
            "p",
            "margin:0 0 6px;padding:0;font-size:13px;font-weight:500;color:#334155;text-align:left;",
            entry.headline,
          ),
        );
      }
      (entry.bullets || []).slice(0, 3).forEach((bullet) => {
        list.appendChild(listItem(bullet));
      });

      const openUpdates = (focusVersion, source) => {
        softLog("[whats_new]", {
          action: "open_updates",
          id: entry.id,
          source,
          focusVersion: focusVersion || null,
        });
        closeSoftPrompt();
        void renderUpdatesHistory({
          focusVersion,
          markSeen: true,
          source,
        });
      };

      const moreDetails = createTextButton("More details for this version");
      moreDetails.style.display = "block";
      moreDetails.style.margin = "0 auto 4px";
      moreDetails.addEventListener("click", () => {
        openUpdates(entry.version, "whats_new_more_details");
      });

      const seeAll = createTextButton("See all updates & older releases");
      seeAll.style.display = "block";
      seeAll.style.margin = "0 auto 12px";
      seeAll.addEventListener("click", () => {
        openUpdates("", "whats_new_see_all");
      });

      const gotIt = createPrimaryButton("Got it");
      gotIt.addEventListener("click", () => {
        softLog("[whats_new]", {
          action: "got_it",
          id: entry.id,
          multiJump: !!multiJump,
        });
        void markWhatsNewSeen().then(closeSoftPrompt);
      });

      card.append(createLogo(), title, tagline, meta, section, list);

      if (multiJump) {
        card.appendChild(
          api.createStyledElement(
            "p",
            "margin:0 0 12px;font-size:11px;line-height:1.45;font-style:italic;color:#94a3b8;text-align:left;",
            "Plus other improvements since your last visit.",
          ),
        );
      }

      const builtBy = api.createStyledElement(
        "p",
        "margin:0 0 10px;font-size:12px;color:#51627d;text-align:center;",
      );
      const authorLink = document.createElement("a");
      authorLink.href = ASS.branding.authorUrl || "https://vijitdua.com";
      authorLink.target = "_blank";
      authorLink.rel = "noopener noreferrer";
      authorLink.className = "ass-soft-link";
      authorLink.textContent = "Vijit Dua";
      authorLink.style.textDecoration = "underline";
      const contributorsLink = document.createElement("a");
      contributorsLink.href = "https://vijitdua.com/contributions";
      contributorsLink.target = "_blank";
      contributorsLink.rel = "noopener noreferrer";
      contributorsLink.className = "ass-soft-link";
      contributorsLink.textContent = "Contributors";
      builtBy.append("By ", authorLink, " & ", contributorsLink);
      card.append(builtBy, moreDetails, seeAll, gotIt);

      void isFeedbackEligible().then((eligible) => {
        softLog("[whats_new]", {
          action: "feedback_bridge",
          eligible: !!eligible,
          id: entry.id,
        });
        if (!eligible || !ui.softPromptRoot) {
          return;
        }
        const feedbackLink = createTextButton("Got feedback on ASS?");
        feedbackLink.addEventListener("click", () => {
          softLog("[whats_new]", {
            action: "feedback_bridge_click",
            id: entry.id,
          });
          void markWhatsNewSeen().then(() => {
            closeSoftPrompt();
            renderFeedbackAsk({ reason: "whats_new_bridge" });
          });
        });
        card.appendChild(feedbackLink);
      });
    });
  }

  async function maybeShowWhatsNew() {
    if (window.self !== window.top) {
      softLog("[whats_new]", { action: "skip", skipReason: "iframe" });
      return;
    }
    if (isBlockingModalOpen()) {
      softLog("[whats_new]", { action: "skip", skipReason: "blocking_modal" });
      return;
    }

    if (api.shouldResetWhatsNewFromUrl?.()) {
      await clearWhatsNewState();
      softLog("[whats_new]", { action: "assReset", note: "cleared" });
    }

    const onboardingKey = config.onboardingStorageKey;
    const stored = await storageGet([
      onboardingKey,
      STORAGE.whatsNewSeenId,
      STORAGE.lastSeenManifestVersion,
    ]);

    // Brand-new users still in onboarding: skip. Returning users (including
    // those with no lastSeenManifestVersion yet) get unseen What’s New entries.
    if (!stored[onboardingKey]) {
      return;
    }

    const unseen = getUnseenEntries(stored[STORAGE.whatsNewSeenId]);
    if (!unseen.length) {
      return;
    }

    const latest = unseen[0];
    const toVersion = getManifestVersion() || latest.version;
    const fromVersion = stored[STORAGE.lastSeenManifestVersion] || "";

    softLog("[whats_new]", {
      action: "show",
      id: latest.id,
      unseenCount: unseen.length,
      fromVersion,
      toVersion,
      multiJump: unseen.length > 1,
    });

    renderWhatsNew(latest, {
      multiJump: unseen.length > 1,
      fromVersion,
      toVersion,
    });
  }

  function dismissBlockingModalsForPreview() {
    api.closeDeveloperPanel?.();
    api.closeSettingsPanel?.();
    if (ui.onboardingRoot) {
      ui.onboardingRoot.remove();
      ui.onboardingRoot = null;
    }
    closeSoftPrompt();
  }

  function previewFromVersion(toVersion) {
    const parts = parseVersionParts(toVersion);
    while (parts.length < 3) {
      parts.push(0);
    }
    if (parts[2] > 0) {
      parts[2] -= 1;
    } else if (parts[1] > 0) {
      parts[1] -= 1;
    } else if (parts[0] > 0) {
      parts[0] -= 1;
      parts[1] = 0;
      parts[2] = 0;
    }
    return parts.join(".");
  }

  async function forceShowWhatsNew() {
    if (window.self !== window.top) {
      softLog("[whats_new]", { action: "force_show", ok: false, skipReason: "iframe" });
      return false;
    }
    const latest = getEntries()[0];
    if (!latest) {
      softLog("[whats_new]", {
        action: "force_show",
        ok: false,
        skipReason: "no_entries",
      });
      return false;
    }
    dismissBlockingModalsForPreview();
    const stored = await storageGet([STORAGE.lastSeenManifestVersion]);
    const toVersion = getManifestVersion() || latest.version;
    const fromVersion =
      stored[STORAGE.lastSeenManifestVersion] || previewFromVersion(toVersion);
    softLog("[whats_new]", {
      action: "force_show",
      ok: true,
      id: latest.id,
      fromVersion,
      toVersion,
    });
    renderWhatsNew(latest, {
      multiJump: false,
      fromVersion,
      toVersion,
    });
    return true;
  }

  async function forceShowUpdatesHistory(options = {}) {
    if (window.self !== window.top) {
      softLog("[updates_history]", {
        action: "force_show",
        ok: false,
        skipReason: "iframe",
      });
      return false;
    }
    dismissBlockingModalsForPreview();
    const ok = await renderUpdatesHistory({
      focusVersion: options.focusVersion || "",
      markSeen: false,
      source: options.source || "force_show",
    });
    softLog("[updates_history]", {
      action: "force_show",
      ok: !!ok,
      focusVersion: options.focusVersion || null,
      source: options.source || "force_show",
    });
    return !!ok;
  }

  function forceShowFeedbackPrompt(options = {}) {
    if (window.self !== window.top) {
      softLog("[feedback_prompt]", {
        action: "force_show",
        ok: false,
        skipReason: "iframe",
      });
      return false;
    }
    dismissBlockingModalsForPreview();
    softLog("[feedback_prompt]", {
      action: "force_show",
      ok: true,
      reason: options.reason || "dev_preview",
    });
    renderFeedbackAsk({ reason: options.reason || "dev_preview" });
    return true;
  }

  async function handleAssResetFromUrl() {
    if (api.shouldResetFeedbackFromUrl?.()) {
      await clearFeedbackState();
      softLog("[feedback_prompt]", { action: "assReset", note: "cleared" });
    }
    if (api.shouldResetWhatsNewFromUrl?.()) {
      await clearWhatsNewState();
      softLog("[whats_new]", { action: "assReset", note: "cleared" });
    }
  }

  api.markWhatsNewSeenPayload = markWhatsNewSeenPayload;
  api.maybeShowWhatsNew = maybeShowWhatsNew;
  api.maybeShowFeedbackPrompt = maybeShowFeedbackPrompt;
  api.showFeedbackPrompt = renderFeedbackAsk;
  api.forceShowWhatsNew = forceShowWhatsNew;
  api.forceShowUpdatesHistory = forceShowUpdatesHistory;
  api.forceShowFeedbackPrompt = forceShowFeedbackPrompt;
  api.clearWhatsNewState = clearWhatsNewState;
  api.clearFeedbackState = clearFeedbackState;
  api.copyShareMessage = copyShareMessage;
  api.handleAssResetFromUrl = handleAssResetFromUrl;
  api.SOFT_PROMPT_STORAGE = STORAGE;
})();
