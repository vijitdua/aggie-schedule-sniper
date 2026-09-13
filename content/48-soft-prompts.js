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
  const STYLE_ID = "ass-soft-prompt-styles-v2";

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

  function openSoftCard(buildCard, { onBackdrop } = {}) {
    if (window.self !== window.top || isBlockingModalOpen()) {
      return false;
    }
    api.closeSettingsPanel?.();
    ensureStyles();
    const backdrop = createBackdrop();
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
      `I used Aggie Schedule Sniper for registration — ${
        ASS.branding.shareUrl || "https://ass.vijit.app"
      }`;
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
    await storageSet(markWhatsNewSeenPayload());
  }

  async function isFeedbackEligible() {
    const result = await storageGet([
      STORAGE.feedbackSettled,
      STORAGE.feedbackSnoozeUntil,
      STORAGE.feedbackNotNowCount,
    ]);
    if (result[STORAGE.feedbackSettled]) {
      return false;
    }
    const notNowCount = Number(result[STORAGE.feedbackNotNowCount] || 0);
    if (notNowCount >= MAX_NOT_NOW) {
      return false;
    }
    const snoozeUntil = Number(result[STORAGE.feedbackSnoozeUntil] || 0);
    if (snoozeUntil && Date.now() < snoozeUntil) {
      return false;
    }
    return true;
  }

  async function settleFeedback() {
    await storageSet({
      [STORAGE.feedbackSettled]: true,
      [STORAGE.feedbackSnoozeUntil]: 0,
    });
  }

  async function snoozeFeedback() {
    const result = await storageGet([STORAGE.feedbackNotNowCount]);
    const nextCount = Number(result[STORAGE.feedbackNotNowCount] || 0) + 1;
    if (nextCount >= MAX_NOT_NOW) {
      await storageSet({
        [STORAGE.feedbackSettled]: true,
        [STORAGE.feedbackNotNowCount]: nextCount,
        [STORAGE.feedbackSnoozeUntil]: 0,
      });
      return;
    }
    await storageSet({
      [STORAGE.feedbackNotNowCount]: nextCount,
      [STORAGE.feedbackSnoozeUntil]: Date.now() + SNOOZE_MS,
    });
  }

  function renderFeedbackAsk() {
    openSoftCard(
      (card) => {
        const title = createTitle("Was ass.vijit.app helpful?");
        const stack = document.createElement("div");
        stack.className = "ass-soft-stack";

        const helpedBtn = createPrimaryButton("It helped");
        const notReallyBtn = createOutlineButton("Not really");
        const notNowBtn = createTextButton("Not now");

        helpedBtn.addEventListener("click", () => {
          void settleFeedback().then(() => {
            closeSoftPrompt();
            renderFeedbackPositive();
          });
        });
        notReallyBtn.addEventListener("click", () => {
          void settleFeedback().then(() => {
            closeSoftPrompt();
            renderFeedbackNegative();
          });
        });
        notNowBtn.addEventListener("click", () => {
          void snoozeFeedback().then(closeSoftPrompt);
        });

        stack.append(helpedBtn, notReallyBtn, notNowBtn);
        card.append(createLogo(), title, stack);
      },
      {
        onBackdrop: () => {
          void snoozeFeedback().then(closeSoftPrompt);
        },
      },
    );
  }

  function renderFeedbackPositive() {
    openSoftCard((card) => {
      const title = createTitle("Thank you. That means a lot.", { tight: true });

      const body = document.createElement("div");
      body.className = "ass-soft-body";

      const ask = document.createElement("p");
      ask.textContent =
        "It would mean the world if you left a review or shared this with friends.";

      const credit = document.createElement("p");
      credit.textContent =
        "Aggie Schedule Sniper is built for free & maintained by Vijit Dua and other student contributors. We do not track you, sell your data, or make money from this.";

      body.append(ask, credit);

      const stack = document.createElement("div");
      stack.className = "ass-soft-stack";

      const reviewBtn = createPrimaryButton("Leave a review");
      const shareBtn = createOutlineButton("Share with friends");
      const doneBtn = createTextButton("Done");

      reviewBtn.addEventListener("click", () => {
        const url =
          ASS.branding.reviewsUrl ||
          ASS.branding.shareUrl ||
          "https://ass.vijit.app";
        window.open(url, "_blank", "noopener,noreferrer");
        closeSoftPrompt();
      });
      shareBtn.addEventListener("click", () => {
        void copyShareMessage().then(closeSoftPrompt);
      });
      doneBtn.addEventListener("click", closeSoftPrompt);

      stack.append(reviewBtn, shareBtn, doneBtn);
      card.append(createLogo(), title, body, stack);
    });
  }

  function renderFeedbackNegative() {
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
        const url =
          ASS.branding.supportUrl || "https://vijitdua.com/support/ass";
        window.open(url, "_blank", "noopener,noreferrer");
        closeSoftPrompt();
      });
      noThanksBtn.addEventListener("click", closeSoftPrompt);

      stack.append(sendBtn, noThanksBtn);
      card.append(createLogo(), title, body, stack);
    });
  }

  async function maybeShowFeedbackPrompt(options = {}) {
    if (window.self !== window.top || isBlockingModalOpen()) {
      return;
    }
    if (!(await isFeedbackEligible())) {
      return;
    }
    api.snipeLog?.("[feedback_prompt]", {
      action: "show",
      reason: options.reason || "unknown",
    });
    renderFeedbackAsk();
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
        meta.append("updated ");
        appendVersionWithBump(meta, fromVersion, toVersion);
        if (dateLabel) {
          meta.append(` • ${dateLabel}`);
        }
      } else {
        const ver = toVersion || entry.version;
        meta.textContent = dateLabel
          ? `updated v${ver} • ${dateLabel}`
          : `updated v${ver}`;
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
      (entry.bullets || []).slice(0, 2).forEach((bullet) => {
        list.appendChild(listItem(bullet));
      });

      const gotIt = createPrimaryButton("Got it");
      gotIt.addEventListener("click", () => {
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

      card.appendChild(gotIt);

      void isFeedbackEligible().then((eligible) => {
        if (!eligible || !ui.softPromptRoot) {
          return;
        }
        const feedbackLink = createTextButton("Got feedback on ASS?");
        feedbackLink.addEventListener("click", () => {
          void markWhatsNewSeen().then(() => {
            closeSoftPrompt();
            renderFeedbackAsk();
          });
        });
        card.appendChild(feedbackLink);
      });
    });
  }

  async function maybeShowWhatsNew() {
    if (window.self !== window.top || isBlockingModalOpen()) {
      return;
    }

    if (api.shouldResetWhatsNewFromUrl?.()) {
      await clearWhatsNewState();
      api.snipeLog?.("[whats_new]", { action: "assReset", note: "cleared" });
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

    api.snipeLog?.("[whats_new]", {
      action: "show",
      id: latest.id,
      unseenCount: unseen.length,
      fromVersion,
      toVersion,
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
      return false;
    }
    const latest = getEntries()[0];
    if (!latest) {
      return false;
    }
    dismissBlockingModalsForPreview();
    const stored = await storageGet([STORAGE.lastSeenManifestVersion]);
    const toVersion = getManifestVersion() || latest.version;
    const fromVersion =
      stored[STORAGE.lastSeenManifestVersion] || previewFromVersion(toVersion);
    api.snipeLog?.("[whats_new]", {
      action: "force_show",
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

  function forceShowFeedbackPrompt() {
    if (window.self !== window.top) {
      return false;
    }
    dismissBlockingModalsForPreview();
    api.snipeLog?.("[feedback_prompt]", { action: "force_show" });
    renderFeedbackAsk();
    return true;
  }

  async function handleAssResetFromUrl() {
    if (api.shouldResetFeedbackFromUrl?.()) {
      await clearFeedbackState();
      api.snipeLog?.("[feedback_prompt]", { action: "assReset", note: "cleared" });
    }
    if (api.shouldResetWhatsNewFromUrl?.()) {
      await clearWhatsNewState();
      api.snipeLog?.("[whats_new]", { action: "assReset", note: "cleared" });
    }
  }

  api.markWhatsNewSeenPayload = markWhatsNewSeenPayload;
  api.maybeShowWhatsNew = maybeShowWhatsNew;
  api.maybeShowFeedbackPrompt = maybeShowFeedbackPrompt;
  api.showFeedbackPrompt = renderFeedbackAsk;
  api.forceShowWhatsNew = forceShowWhatsNew;
  api.forceShowFeedbackPrompt = forceShowFeedbackPrompt;
  api.clearWhatsNewState = clearWhatsNewState;
  api.clearFeedbackState = clearFeedbackState;
  api.copyShareMessage = copyShareMessage;
  api.handleAssResetFromUrl = handleAssResetFromUrl;
  api.SOFT_PROMPT_STORAGE = STORAGE;
})();
