(() => {
  const ASS = window.ASS;
  const { config, state, ui, api } = ASS;
  const styles = ASS.uiStyles;
  const { snipeLog } = api;

  function createStyledElement(tagName, cssText, textContent) {
    const element = document.createElement(tagName);
    element.style.cssText = cssText || "";
    if (textContent != null && textContent !== "") {
      element.textContent = textContent;
    }
    return element;
  }

  function insertUiNearPassTimes(node) {
    const host =
      document.getElementById("PassTimesContainer") ||
      document.querySelector(".passtime-container") ||
      document.querySelector(
        ".schedule-builder, .pass-times, .registration, .search-container, .course-search, .search-form, main, #main, body",
      );

    const hostTagName = host?.tagName?.toLowerCase() || "";
    if (!host || hostTagName === "body" || hostTagName === "html") {
      document.body.appendChild(node);
      return;
    }
    host.insertAdjacentElement("afterend", node);
  }

  function createLogoElement() {
    const image = document.createElement("img");
    image.src = chrome.runtime.getURL("128.png");
    image.alt = "Aggie Schedule Sniper";
    image.style.cssText =
      "width:18px;height:18px;border-radius:4px;object-fit:cover;display:block;";

    image.addEventListener(
      "error",
      () => {
        snipeLog("[ui]", {
          action: "logo_image_failed",
          src: image.src,
        });
        const fallbackBadge = createStyledElement(
          "span",
          "display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;background:#01256e;color:#ffbf00;font:700 11px system-ui;",
        );
        fallbackBadge.textContent = "A";
        image.replaceWith(fallbackBadge);
      },
      { once: true },
    );

    return image;
  }

  function applyStatusChipStyle(text, tone) {
    const toneStyles = styles.toneStyles;
    const activeStyle = toneStyles[tone] || toneStyles.neutral;

    ui.statusChip.textContent = text;
    ui.statusChip.style.background = activeStyle.background;
    ui.statusChip.style.borderColor = activeStyle.borderColor;
    ui.statusChip.style.color = activeStyle.color;
    ui.statusChip.style.boxShadow = activeStyle.boxShadow;
    ui.statusChip.style.display = "inline-flex";
  }

  function buildRegistrationStatus(targetPass, activePass) {
    if (!activePass) {
      return {
        tone: "neutral",
        text: `🎯 Sniping armed — waiting for Pass ${targetPass.passNumber}`,
      };
    }

    const clickState = state.clickAttemptStateByPassId.get(activePass.passId);

    if (!clickState || clickState.outcome === "idle") {
      return {
        tone: "busy",
        text: `🟦 Pass ${activePass.passNumber} active — preparing click`,
      };
    }

    const totalClickAttempts = 1 + config.clickRetryBackoffMs.length;

    if (clickState.outcome === "pending") {
      return {
        tone: "busy",
        text: `⚡ Sniping Pass ${activePass.passNumber} — attempt ${clickState.attempts}/${totalClickAttempts}`,
      };
    }

    if (clickState.outcome === "success") {
      return {
        tone: "success",
        text: `✅ ${clickState.message}`,
      };
    }
    return {
      tone: "danger",
      text: `❌ ${clickState.message}`,
    };
  }

  function renderOverlayUi(targetPass, activePass) {
    const shouldShowCountdown = state.settings.showCountdown;
    const shouldShowAutoRegisterStatus = state.settings.autoRegister;

    const isEverythingHidden =
      !shouldShowCountdown && !shouldShowAutoRegisterStatus;

    const noTrackedPass = !targetPass;
    ui.root.style.justifyContent = "center";
    ui.launcherButton.style.display = "inline-flex";
    ui.launcherLabel.textContent = isEverythingHidden
      ? "Aggie Schedule Sniper  ⚙"
      : "Aggie Sniper  ⚙";

    ui.countdownChip.style.display = "none";
    ui.statusChip.style.display = "none";

    if (state.sessionExpiryWarning) {
      applyStatusChipStyle(
        state.settings.keepSessionAlive
          ? "Session expiring — clicking Continue Session…"
          : "Please sign in again — session may have expired.",
        "danger",
      );
      if (targetPass && shouldShowCountdown) {
        ui.countdownChip.textContent = `⏳ ${api.formatCountdownLabel(targetPass)}`;
        ui.countdownChip.style.display = "inline-flex";
      }
      return;
    }

    if (isEverythingHidden) {
      applyStatusChipStyle(
        "Automatic registration is off — open ⚙ settings to enable",
        "neutral",
      );
      return;
    }

    if (noTrackedPass) {
      const noPassMsg = !shouldShowAutoRegisterStatus
        ? "No upcoming pass-time · Automatic registration off (⚙)"
        : "No upcoming pass-time";
      applyStatusChipStyle(noPassMsg, "neutral");
      return;
    }

    if (shouldShowCountdown) {
      ui.countdownChip.textContent = `⏳ ${api.formatCountdownLabel(targetPass)}`;
      ui.countdownChip.style.display = "inline-flex";
    }

    if (shouldShowAutoRegisterStatus) {
      const status = buildRegistrationStatus(targetPass, activePass);
      applyStatusChipStyle(status.text, status.tone);
    } else {
      applyStatusChipStyle(
        "Automatic registration is off — change in ⚙ settings",
        "neutral",
      );
    }
  }

  function openSettingsPanel(event) {
    if (event) event.stopPropagation();
    if (ui.settingsPanel) {
      return;
    }

    snipeLog("[ui]", { action: "open_settings_panel" });

    ui.backdrop = createStyledElement(
      "div",
      "position:fixed;inset:0;background:rgba(0,0,0,.22);z-index:2147483645;",
    );
    ui.backdrop.addEventListener("click", closeSettingsPanel);

    const panelHeightPx = config.embeddedPanelHeightPx ?? 400;
    ui.settingsPanel = createStyledElement(
      "div",
      `position:fixed;top:18px;right:18px;width:${config.embeddedPanelWidthPx}px;height:${panelHeightPx}px;background:#fff;border:1px solid #d8dee6;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.25);overflow:hidden;z-index:2147483646;`,
    );

    const iframe = document.createElement("iframe");
    const resetOnboarding = api.shouldResetOnboardingFromUrl?.();
    const iframeQuery = resetOnboarding ? "embedded=1&assReset=1" : "embedded=1";
    iframe.src = chrome.runtime.getURL(`popup.html?${iframeQuery}`);
    iframe.style.cssText = "display:block;width:100%;height:100%;border:0;";

    ui.settingsPanel.appendChild(iframe);
    document.body.append(ui.backdrop, ui.settingsPanel);
  }

  function closeSettingsPanel() {
    const hadPanel = !!(ui.backdrop || ui.settingsPanel);
    if (ui.backdrop) ui.backdrop.remove();
    if (ui.settingsPanel) ui.settingsPanel.remove();

    ui.backdrop = null;
    ui.settingsPanel = null;

    if (hadPanel) {
      snipeLog("[ui]", { action: "close_settings_panel" });
    }
  }

  function ensureOverlayUi() {
    if (ui.root) {
      return;
    }
    ui.root = createStyledElement("div", styles.rootContainer);
    ui.root.addEventListener("click", openSettingsPanel);

    ui.launcherButton = createStyledElement("button", styles.launcherButton);
    ui.launcherButton.type = "button";
    ui.launcherButton.appendChild(createLogoElement());

    ui.launcherLabel = createStyledElement("span", "");
    ui.launcherButton.appendChild(ui.launcherLabel);

    ui.countdownChip = createStyledElement("div", styles.chip);
    ui.statusChip = createStyledElement("div", styles.chip);

    ui.root.append(ui.launcherButton, ui.countdownChip, ui.statusChip);
    insertUiNearPassTimes(ui.root);
  }

  Object.assign(api, {
    ensureOverlayUi,
    renderOverlayUi,
    openSettingsPanel,
    closeSettingsPanel,
    createStyledElement,
  });
})();
