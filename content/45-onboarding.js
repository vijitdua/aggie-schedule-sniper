(() => {
  const ASS = window.ASS;
  const { config, ui, api } = ASS;

  const CARD_STYLE = [
    "max-width:360px",
    "width:100%",
    "background:#fff",
    "border-radius:16px",
    "padding:22px 24px 20px",
    "box-shadow:0 24px 48px rgba(0,0,0,.22)",
    "font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "color:#01256e",
    "text-align:center",
    "box-sizing:border-box",
  ].join(";");

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
        renderOnboardingModal();
      });
    };

    if (forceShow) {
      api.snipeLog("[onboarding]", { action: "assReset", note: "showing welcome modal" });
      clearOnboardingDismissed(proceed);
      return;
    }

    proceed();
  }

  function settingsBullet() {
    const li = api.createStyledElement(
      "li",
      "margin:0 0 10px;padding-left:20px;position:relative;text-align:left;color:#334155;",
    );
    const dot = api.createStyledElement(
      "span",
      "position:absolute;left:0;top:0.45em;width:8px;height:8px;border-radius:50%;background:#ffbf00;",
    );
    li.appendChild(dot);

    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("128.png");
    icon.alt = "";
    icon.width = 18;
    icon.height = 18;
    icon.style.cssText =
      "display:inline-block;width:18px;height:18px;margin:0 4px -2px;border-radius:4px;vertical-align:middle;object-fit:cover;";

    li.append("Click on ", icon, " to change your settings");
    return li;
  }

  function bullet(text, highlight) {
    const li = api.createStyledElement(
      "li",
      "margin:0 0 10px;padding-left:20px;position:relative;text-align:left;color:#334155;",
    );
    const dot = api.createStyledElement(
      "span",
      "position:absolute;left:0;top:0.45em;width:8px;height:8px;border-radius:50%;background:#ffbf00;",
    );
    li.appendChild(dot);
    if (highlight && text.includes(highlight)) {
      const i = text.indexOf(highlight);
      if (i >= 0) {
        if (i > 0) {
          li.append(text.slice(0, i));
        }
        li.append(
          api.createStyledElement(
            "strong",
            "font-weight:600;color:#01256e;",
            highlight,
          ),
        );
        if (i + highlight.length < text.length) {
          li.append(text.slice(i + highlight.length));
        }
        return li;
      }
    }
    li.append(text);
    return li;
  }

  function renderOnboardingModal() {
    if (ui.onboardingRoot) {
      return;
    }

    const builtByHref = ASS.branding.homepageUrl || "https://vijitdua.com";

    const backdrop = api.createStyledElement(
      "div",
      [
        "position:fixed",
        "inset:0",
        "background:rgba(1,37,110,.4)",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:20px",
        "box-sizing:border-box",
      ].join(";"),
    );

    const card = api.createStyledElement("div", CARD_STYLE);

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
      "Automatic course registration",
    );

    const list = api.createStyledElement(
      "ul",
      "margin:0 auto 16px;padding:0;list-style:none;max-width:300px;",
    );
    list.append(
      bullet(
        "Automatically registers you for your courses during your pass time",
      ),
      bullet(
        "Keep this tab open, laptop awake, and connected to the internet for this to work",
      ),
      settingsBullet(),
    );

    const builtBy = api.createStyledElement(
      "p",
      "margin:0 0 14px;font-size:12px;color:#51627d;",
    );
    const builtByLink = document.createElement("a");
    builtByLink.href = builtByHref;
    builtByLink.target = "_blank";
    builtByLink.rel = "noopener noreferrer";
    builtByLink.textContent = "Built by Vijit Dua";
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

    continueBtn.addEventListener("click", () => {
      chrome.storage.local.set({ [config.onboardingStorageKey]: true }, () => {
        backdrop.remove();
        ui.onboardingRoot = null;
      });
    });

    card.append(logo, title, tagline, list, builtBy, continueBtn);
    backdrop.appendChild(card);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        continueBtn.click();
      }
    });

    document.body.appendChild(backdrop);
    ui.onboardingRoot = backdrop;
  }

  api.maybeShowOnboarding = maybeShowOnboarding;
  api.showOnboardingModal = renderOnboardingModal;
  api.clearOnboardingDismissed = clearOnboardingDismissed;
})();
