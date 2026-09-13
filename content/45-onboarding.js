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

  const ONBOARDING_STYLE_ID = "ass-onboarding-styles";

  function ensureOnboardingStyles() {
    if (document.getElementById(ONBOARDING_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = ONBOARDING_STYLE_ID;
    style.textContent = `
      .ass-onboarding-share-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 1px solid #dce2ea;
        background: #fff;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #01256e;
      }
      .ass-onboarding-share-btn:hover {
        border-color: #ffbf00;
      }
      .ass-onboarding-share-btn:focus-visible {
        outline: 2px solid #ffbf00;
        outline-offset: 2px;
      }
      .ass-onboarding-share-btn.is-copied {
        border-color: #16a34a;
        background: #ecfdf5;
        color: #166534;
      }
      .ass-onboarding-share-btn svg {
        width: 17px;
        height: 17px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ass-onboarding-toast {
        position: absolute;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1;
        max-width: calc(100% - 48px);
        box-sizing: border-box;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.35;
        text-align: center;
        background: #15803d;
        color: #fff;
        box-shadow: 0 4px 12px rgba(1, 37, 110, 0.15);
        pointer-events: none;
      }
      .ass-onboarding-toast[hidden] {
        display: none !important;
      }
      .ass-onboarding-toast--error {
        background: #b91c1c;
      }
    `;
    document.head.appendChild(style);
  }

  async function copyShareUrl(text) {
    if (window.ASS_CLIPBOARD) {
      return window.ASS_CLIPBOARD.copyText(text);
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  function clearOnboardingDismissed(done) {
    chrome.storage.local.remove(config.onboardingStorageKey, () => {
      done?.();
    });
  }

  function maybeShowOnboarding() {
    if (window.self !== window.top || ui.onboardingRoot) {
      return;
    }

    const forceShow = api.shouldResetOnboardingFromUrl();

    const proceed = () => {
      chrome.storage.local.get([config.onboardingStorageKey], (result) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (!forceShow && result?.[config.onboardingStorageKey]) {
          return;
        }
        renderOnboardingModal({ firstRun: true });
      });
    };

    if (forceShow) {
      api.snipeLog("[onboarding]", { action: "assReset", note: "showing welcome modal" });
      clearOnboardingDismissed(proceed);
      return;
    }

    proceed();
  }

  function listItem() {
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
    return li;
  }

  function renderOnboardingModal(options = {}) {
    const firstRun = !!options.firstRun;

    if (ui.onboardingRoot) {
      return;
    }

    api.closeSettingsPanel?.();

    const builtByHref = ASS.branding.homepageUrl || "https://vijitdua.com";
    const shareUrl = ASS.branding.shareUrl || "https://ass.vijit.app";

    ensureOnboardingStyles();

    const backdrop = api.createStyledElement(
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

    const card = api.createStyledElement("div", CARD_STYLE);

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "ass-onboarding-share-btn";
    shareBtn.title = "Share";
    shareBtn.setAttribute("aria-label", "Share Aggie Schedule Sniper");
    shareBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8"></path><path d="M12 3v13"></path><path d="M8 8l4-4 4 4"></path></svg>';

    const toast = document.createElement("div");
    toast.className = "ass-onboarding-toast";
    toast.hidden = true;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    let toastTimer = 0;
    const showToast = (message, kind) => {
      toast.textContent = message;
      toast.classList.toggle("ass-onboarding-toast--error", kind === "error");
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.hidden = true;
      }, 3200);
    };

    shareBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void copyShareUrl(shareUrl).then((copied) => {
        if (copied) {
          shareBtn.classList.add("is-copied");
          showToast("Copied to your clipboard", "success");
          window.setTimeout(() => {
            shareBtn.classList.remove("is-copied");
          }, 2000);
          return;
        }
        showToast("Couldn't copy link", "error");
      });
    });

    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("128.png");
    logo.alt = "Aggie Schedule Sniper";
    logo.style.cssText =
      "display:block;width:48px;height:48px;margin:0 auto 12px;border-radius:12px;object-fit:cover;";

    const title = api.createStyledElement(
      "h2",
      "margin:0 0 6px;font-size:20px;font-weight:700;line-height:1.2;color:#01256e;",
      "Aggie Schedule Sniper",
    );
    const tagline = api.createStyledElement(
      "p",
      "margin:0 0 16px;font-size:15px;font-weight:600;color:#51627d;",
      "ass.vijit.app",
    );

    const list = api.createStyledElement(
      "ul",
      "margin:0 auto 16px;padding:0;list-style:none;max-width:348px;",
    );

    const item1 = listItem();
    item1.append("Automatic class registration to save you from waitlists");
    list.appendChild(item1);

    const item3 = listItem();
    item3.append("Exports your schedule to your calendar");
    list.appendChild(item3);

    const itemRmp = listItem();
    itemRmp.append(
      "Adds RateMyProfessors ratings in course search",
    );
    list.appendChild(itemRmp);

    const itemPlanner = listItem();
    itemPlanner.append(
      "Advanced Planner finds conflict-free section combos for your courses",
    );
    list.appendChild(itemPlanner);

    const item4 = listItem();
    const settingsIcon = document.createElement("img");
    settingsIcon.src = chrome.runtime.getURL("128.png");
    settingsIcon.alt = "";
    settingsIcon.width = 18;
    settingsIcon.height = 18;
    settingsIcon.style.cssText =
      "display:inline-block;width:18px;height:18px;margin:0 4px -2px;border-radius:4px;vertical-align:middle;object-fit:cover;";
    item4.append("Click ", settingsIcon, " to change your settings");
    list.appendChild(item4);

    const disclaimer = api.createStyledElement(
      "p",
      "margin:0 auto 14px;max-width:348px;font-size:11px;line-height:1.5;font-style:italic;text-align:center;color:#94a3b8;",
      "Aggie Schedule Sniper's automatic registeration requires your device to stay awake and your browser to have schedule builder open and logged in for it to work",
    );

    const builtBy = api.createStyledElement(
      "p",
      "margin:0 0 14px;font-size:12px;color:#51627d;",
    );
    const builtByLink = document.createElement("a");
    builtByLink.href = builtByHref;
    builtByLink.target = "_blank";
    builtByLink.rel = "noopener noreferrer";
    builtByLink.textContent = "By Vijit Dua";
    builtByLink.style.color = "#51627d";
    builtByLink.style.textDecoration = "none";
    builtByLink.addEventListener("mouseenter", () => {
      builtByLink.style.textDecoration = "underline";
    });
    builtByLink.addEventListener("mouseleave", () => {
      builtByLink.style.textDecoration = "none";
    });
    builtBy.appendChild(builtByLink);

    const continueBtn = api.createStyledElement(
      "button",
      [
        "width:100%",
        "height:42px",
        "border:none",
        "border-radius:999px",
        "background:#ffbf00",
        "color:#01256e",
        "font:700 15px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        "cursor:pointer",
      ].join(";"),
    );
    continueBtn.type = "button";
    continueBtn.textContent = "Continue";

    const dismissModal = () => {
      backdrop.remove();
      ui.onboardingRoot = null;
    };

    continueBtn.addEventListener("click", () => {
      if (firstRun) {
        chrome.storage.local.set({ [config.onboardingStorageKey]: true }, dismissModal);
        return;
      }
      dismissModal();
    });

    card.append(shareBtn, logo, title, tagline, list, disclaimer, builtBy, toast, continueBtn);
    backdrop.appendChild(card);

    if (!firstRun) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          dismissModal();
        }
      });
    }

    document.body.appendChild(backdrop);
    ui.onboardingRoot = backdrop;
  }

  function showOnboardingModal() {
    renderOnboardingModal({ firstRun: false });
  }

  api.maybeShowOnboarding = maybeShowOnboarding;
  api.showOnboardingModal = showOnboardingModal;
  api.clearOnboardingDismissed = clearOnboardingDismissed;
})();
