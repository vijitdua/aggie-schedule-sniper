(() => {
  const ASS = window.ASS;
  const { config, state, api } = ASS;
  const { snipeLog, assConsoleError, wait } = api;

  function snapshotRegistrationHeuristics() {
    return {
      unregistered: pageShowsUnregisteredCourseStatus(),
      registered: pageShowsRegisteredCourseStatus(),
      noCoursesLeftBanner: hasNoCoursesLeftToRegisterState(),
      pageAlreadyDone: pageAlreadyShowsRegisteredState(),
    };
  }

  function describeRegisterControl(node) {
    if (!node) {
      return null;
    }

    const label = (node.textContent || node.value || "").trim();

    return {
      tag: node.tagName,
      id: node.id || null,
      type: node.type || null,
      name: node.getAttribute?.("name") || null,
      className:
        typeof node.className === "string"
          ? node.className.slice(0, 200)
          : null,
      label: label.slice(0, 220),
      outerHTMLSnippet: node.outerHTML?.slice(0, 400) ?? null,
    };
  }

  function describeInteractivity(node) {
    if (!node) {
      return { interactive: false, reason: "no_node" };
    }

    const computedStyle = getComputedStyle(node);
    const isHidden =
      node.offsetParent === null ||
      computedStyle.display === "none" ||
      computedStyle.visibility === "hidden";
    const isDisabled =
      node.disabled === true || /\bdisabled\b/i.test(node.className || "");

    return {
      interactive: !isHidden && !isDisabled,
      isHidden,
      isDisabled,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      offsetParentNull: node.offsetParent === null,
    };
  }

  async function attemptRegisterClickWithRetries(clickState) {
    const totalWaves = 1 + config.clickRetryBackoffMs.length;
    const alreadyDone = pageAlreadyShowsRegisteredState();

    if (alreadyDone) {
      snipeLog("[registration_wave]", {
        wave: 0,
        ofWaves: totalWaves,
        note: "Skipped all waves — pageAlreadyShowsRegisteredState before first click",
        heuristics: snapshotRegistrationHeuristics(),
      });
      return true;
    }

    for (let attemptIndex = 0; attemptIndex < totalWaves; attemptIndex += 1) {
      clickState.attempts = attemptIndex + 1;
      const hadCachedControl =
        state.cachedRegisterButton &&
        document.contains(state.cachedRegisterButton);
      const cacheRefBefore = hadCachedControl
        ? state.cachedRegisterButton
        : null;

      const registerButton = findRegisterButton();
      const resolvedFromSessionCache = !!(
        cacheRefBefore &&
        registerButton &&
        registerButton === cacheRefBefore
      );
      const buttonMeta = describeRegisterControl(registerButton);
      const interactivity = describeInteractivity(registerButton);

      let waveNote = "no_control_found";
      let clickDispatched = false;
      let dispatchError = null;
      let likely = false;
      let pageDone = false;

      if (registerButton && !interactivity.interactive) {
        waveNote = "control_found_but_not_interactive";
        state.cachedRegisterButton = null;
      } else if (registerButton && interactivity.interactive) {
        waveNote = "dispatching_click";
        try {
          dispatchTrustedLikeClickSequence(registerButton);
          clickDispatched = true;
        } catch (error) {
          assConsoleError("[Aggie Schedule Sniper] click dispatch failed", error);
          dispatchError = error?.message || String(error);
          state.cachedRegisterButton = null;
          waveNote = "dispatch_threw";
        }

        if (clickDispatched) {
          await wait(220);
          likely = didRegistrationLikelySucceed(registerButton);
          pageDone = pageAlreadyShowsRegisteredState();
          if (likely || pageDone) {
            waveNote = "success_heuristic_after_click";
          } else {
            waveNote = "clicked_no_success_signal_yet";
          }
        }
      }

      snipeLog("[registration_wave]", {
        wave: attemptIndex + 1,
        ofWaves: totalWaves,
        waveNote,
        hadCachedControl,
        resolvedFromSessionCache,
        cachedControlBeforeLookup: describeRegisterControl(cacheRefBefore),
        chosenControl: buttonMeta,
        interactivity,
        clickDispatched,
        dispatchError,
        postClick: clickDispatched
          ? {
              didRegistrationLikelySucceed: likely,
              pageAlreadyShowsRegisteredState: pageDone,
              heuristics: snapshotRegistrationHeuristics(),
            }
          : null,
        nextBackoffMs:
          attemptIndex < config.clickRetryBackoffMs.length
            ? config.clickRetryBackoffMs[attemptIndex]
            : null,
      });

      if (clickDispatched && (likely || pageDone)) {
        return true;
      }

      if (attemptIndex < config.clickRetryBackoffMs.length) {
        await wait(config.clickRetryBackoffMs[attemptIndex]);
      }
    }

    const finalPageDone = pageAlreadyShowsRegisteredState();
    snipeLog("[registration_wave]", {
      wave: "final",
      ofWaves: totalWaves,
      waveNote: "retries_exhausted",
      pageAlreadyShowsRegisteredState: finalPageDone,
      heuristics: snapshotRegistrationHeuristics(),
    });
    return finalPageDone;
  }

  function findRegisterButton() {
    if (
      state.cachedRegisterButton &&
      document.contains(state.cachedRegisterButton)
    ) {
      return state.cachedRegisterButton;
    }

    const candidates = Array.from(
      document.querySelectorAll(config.registerButtonSelector),
    ).filter((node) => {
      const label = (node.textContent || node.value || "").trim();
      return (
        config.registerButtonTextRegex.test(label) &&
        !config.excludedButtonTextRegex.test(label)
      );
    });
    const registerAllPreferred =
      candidates.find((node) =>
        /\bregister\s*all\b/i.test(
          (node.textContent || node.value || "").trim(),
        ),
      ) || null;

    const matchingButton = registerAllPreferred || candidates[0] || null;

    state.cachedRegisterButton = matchingButton;
    return matchingButton;
  }

  function dispatchTrustedLikeClickSequence(node) {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    node.focus();

    if (typeof PointerEvent === "function") {
      node.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
      node.dispatchEvent(new PointerEvent("pointerup", eventOptions));
    }

    node.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    node.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    node.click();
  }

  function didRegistrationLikelySucceed(button) {
    if (pageShowsUnregisteredCourseStatus()) {
      return false;
    }

    if (hasNoCoursesLeftToRegisterState()) {
      return true;
    }

    if (pageShowsRegisteredCourseStatus()) {
      return true;
    }

    if (!document.contains(button)) {
      return pageAlreadyShowsRegisteredState();
    }

    const buttonLabel = (
      button.textContent ||
      button.value ||
      ""
    ).toLowerCase();

    return (
      buttonLabel.includes("registered") || buttonLabel.includes("waitlist")
    );
  }

  function pageAlreadyShowsRegisteredState() {
    if (pageShowsUnregisteredCourseStatus()) {
      return false;
    }

    if (hasNoCoursesLeftToRegisterState()) {
      return true;
    }

    return pageShowsRegisteredCourseStatus();
  }

  function pageShowsUnregisteredCourseStatus() {
    const unregisteredStatusSelectors = [
      ".statusIndicator.nonregistered",
      ".statusIndicator2.nonregistered",
      ".statusIndicator.notregistered",
      ".statusIndicator2.notregistered",
      "[class*='nonregistered']",
      "[class*='NonRegistered']",
      "[class*='notregistered']",
      "[class*='NotRegistered']",
    ];

    for (const selector of unregisteredStatusSelectors) {
      let hit = false;
      try {
        hit = !!document.querySelector(selector);
      } catch {
        /* invalid selector */
      }
      if (hit) {
        return true;
      }
    }

    return Array.from(
      document.querySelectorAll(".statusIndicator, .statusIndicator2"),
    ).some((node) => {
      const className =
        typeof node.className === "string" ? node.className : "";
      if (/\bregistered\b/i.test(className)) {
        return false;
      }
      return /\bnot registered\b/i.test(node.textContent || "");
    });
  }

  function pageShowsRegisteredCourseStatus() {
    const registeredStatusSelectors = [
      ".statusIndicator.registered",
      ".statusIndicator2.registered",
    ];

    const hasRegisteredBadge = registeredStatusSelectors.some((selector) =>
      Array.from(document.querySelectorAll(selector)).some((node) =>
        /\bregistered\b/i.test(node.textContent || ""),
      ),
    );

    if (hasRegisteredBadge) {
      return true;
    }

    const pageText = (document.body?.innerText || "").toLowerCase();

    return (
      pageText.includes("already registered") ||
      pageText.includes("you are registered")
    );
  }

  function hasNoCoursesLeftToRegisterState() {
    const pageText = (document.body?.innerText || "").toLowerCase();

    return pageText.includes(
      "you have no courses on this schedule that have not yet been registered/waitlisted",
    );
  }

  async function maybeAttemptAutoRegistration(activePass) {
    if (!state.settings.autoRegister || !activePass) {
      return;
    }

    const isAllowedToRun =
      !!state.simulatedPassTimeMs ||
      state.activationSeenByPassId.get(activePass.passId) === true;
    if (!isAllowedToRun) {
      return;
    }

    const clickState = state.clickAttemptStateByPassId.get(activePass.passId);

    if (!clickState || clickState.started || clickState.outcome === "success") {
      return;
    }
    clickState.started = true;
    clickState.outcome = "pending";
    clickState.message = `Registering for Pass ${activePass.passNumber}...`;
    api.renderApp();

    snipeLog("[registration_attempt]", {
      phase: "start",
      passNumber: activePass.passNumber,
      passId: activePass.passId,
      ucdTest: !!state.simulatedPassTimeMs,
    });

    try {
      const didSucceed = await attemptRegisterClickWithRetries(clickState);
      clickState.outcome = didSucceed ? "success" : "failed";
      clickState.message = didSucceed
        ? "Registered Successfully"
        : "Unable to Register";
      if (didSucceed) {
        window.setTimeout(() => {
          api.maybeShowFeedbackPrompt?.({ reason: "register" });
        }, 900);
      }
    } catch (error) {
      assConsoleError(
        "[Aggie Schedule Sniper] registration attempt failed",
        error,
      );
      clickState.outcome = "failed";
      clickState.message = "Unable to Register (unexpected error)";
    }

    snipeLog("[registration_attempt]", {
      phase: "complete",
      passNumber: activePass.passNumber,
      passId: activePass.passId,
      outcome: clickState.outcome,
      message: clickState.message,
      heuristics: snapshotRegistrationHeuristics(),
    });
  }

  Object.assign(api, {
    snapshotRegistrationHeuristics,
    maybeAttemptAutoRegistration,
    pageAlreadyShowsRegisteredState,
  });
})();
