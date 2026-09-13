(() => {
  const { api } = window.ASS;
  const ICS = window.ASS_ICS;
  const { snipeLog } = api;

  const UCD_BLUE = "#01256e";
  const UCD_GOLD = "#ffbf00";
  const SOFT_BORDER = "#dce2ea";
  const MUTED = "#51627d";
  const COURSE_COLORS = [
    "#01256e",
    "#2563eb",
    "#0e7490",
    "#15803d",
    "#a16207",
    "#9333ea",
  ];
  const DAY_ORDER = ["MO", "TU", "WE", "TH", "FR"];
  const DAY_LABELS = {
    MO: "Mon",
    TU: "Tue",
    WE: "Wed",
    TH: "Thu",
    FR: "Fri",
  };
  const GOOGLE_CALENDAR_IMPORT_URL =
    "https://calendar.google.com/calendar/u/0/r/settings/export";

  let exportModalRoot = null;

  function parseTimeToMinutes(timeStr) {
    const match = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!match) {
      return null;
    }
    let hour = Number(match[1]) % 12;
    if (/pm/i.test(match[3])) {
      hour += 12;
    }
    return hour * 60 + Number(match[2]);
  }

  function formatMinutesLabel(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return mins
      ? `${hour12}:${String(mins).padStart(2, "0")} ${period}`
      : `${hour12} ${period}`;
  }

  function shortCourseLabel(course) {
    const parts = (course.codeSection || "Course").split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0];
  }

  function formatMeetingSummary(meeting) {
    const days = meeting.dayCodes.map((d) => DAY_LABELS[d] || d).join("/");
    return `${days} ${meeting.start}–${meeting.end} · ${meeting.location}`;
  }

  function formatDateRange(bounds) {
    if (bounds?.dateRangeLabel) {
      return bounds.dateRangeLabel;
    }
    if (bounds?.instructionBeginsParts && bounds?.instructionEndsParts) {
      return ICS.formatPtDateRange(
        bounds.instructionBeginsParts,
        bounds.instructionEndsParts,
      );
    }
    return "Quarter dates unavailable";
  }

  function buildExportDateSubtitle(bounds) {
    const wrap = api.createStyledElement(
      "div",
      `margin:0;font-size:11px;line-height:1.45;color:${MUTED};`,
    );
    wrap.appendChild(
      api.createStyledElement(
        "p",
        `margin:0;font-size:11px;color:${MUTED};`,
        formatDateRange(bounds),
      ),
    );

    if (bounds?.source === "manual") {
      wrap.appendChild(
        api.createStyledElement(
          "p",
          `margin:2px 0 0;font-size:10px;color:${MUTED};`,
          "Entered manually",
        ),
      );
      return wrap;
    }

    const registrarUrl =
      window.ASS?.config?.registrarCalendarUrl ||
      "https://registrar.ucdavis.edu/calendar/quarter";
    const shareUrl =
      window.ASS?.branding?.shareUrl || "https://ass.vijit.app";

    const pulled = api.createStyledElement(
      "p",
      `margin:2px 0 0;font-size:10px;line-height:1.4;color:${MUTED};`,
    );
    pulled.append("Quarter dates automatically pulled from the ");
    const registrarLink = document.createElement("a");
    registrarLink.href = registrarUrl;
    registrarLink.target = "_blank";
    registrarLink.rel = "noopener noreferrer";
    registrarLink.textContent = "UC Davis registrar calendar";
    registrarLink.style.cssText = `color:${MUTED};text-decoration:underline;`;
    pulled.appendChild(registrarLink);
    pulled.append(", to save you the hassle.");
    wrap.appendChild(pulled);

    const via = api.createStyledElement(
      "p",
      `margin:2px 0 0;font-size:10px;line-height:1.4;color:${MUTED};`,
    );
    via.append("via ");
    const viaLink = document.createElement("a");
    viaLink.href = shareUrl;
    viaLink.target = "_blank";
    viaLink.rel = "noopener noreferrer";
    viaLink.textContent = "ass.vijit.app";
    viaLink.style.cssText = `color:${MUTED};text-decoration:underline;`;
    via.appendChild(viaLink);
    via.append(" as always");
    wrap.appendChild(via);

    return wrap;
  }

  function termYearFromName(termName) {
    return (termName || "").match(/\b(20\d{2})\b/)?.[1] || null;
  }

  function normalizeQuarterBounds(bounds, termName) {
    if (!bounds?.ok) {
      return { ok: false, error: bounds?.error || "Quarter dates unavailable." };
    }

    const termYear = termYearFromName(termName);
    const startParts =
      bounds.instructionBeginsParts ||
      (bounds.instructionBeginsIso
        ? ICS.isoToParts(bounds.instructionBeginsIso)
        : ICS.parseUsDate(bounds.instructionBegins, termYear));
    const endParts =
      bounds.instructionEndsParts ||
      (bounds.instructionEndsIso
        ? ICS.isoToParts(bounds.instructionEndsIso)
        : ICS.parseUsDate(bounds.instructionEnds || bounds.quarterEnds, termYear));

    if (!startParts || !endParts) {
      snipeLog("[calendar_export]", {
        action: "quarter_bounds_unparsed",
        termName,
        source: bounds.source,
        instructionBegins: bounds.instructionBegins,
        instructionEnds: bounds.instructionEnds,
        quarterEnds: bounds.quarterEnds,
      });
      return { ok: false, error: "Could not parse quarter dates from registrar." };
    }

    if (ICS.compareParts(endParts, startParts) < 0) {
      return { ok: false, error: "Quarter end date is before the start date." };
    }

    return {
      ...bounds,
      ok: true,
      termName: bounds.termName || termName,
      instructionBeginsParts: startParts,
      instructionEndsParts: endParts,
      instructionBeginsIso: ICS.partsToIso(startParts),
      instructionEndsIso: ICS.partsToIso(endParts),
      dateRangeLabel: ICS.formatPtDateRange(startParts, endParts),
    };
  }

  async function resolveQuarterBounds(termName) {
    const registrar = await api.getQuarterBounds(termName);
    let normalized = registrar.ok
      ? normalizeQuarterBounds(registrar, termName)
      : { ok: false, error: registrar.error };

    if (normalized.ok) {
      return normalized;
    }

    snipeLog("[calendar_export]", {
      action: "quarter_bounds_manual_prompt",
      termName,
      registrarOk: registrar.ok,
      error: normalized.error || registrar.error,
    });

    const manual = await promptManualQuarterBounds(termName);
    if (!manual.ok) {
      return manual;
    }
    return normalizeQuarterBounds(manual, termName);
  }

  function createQuarterDateField(labelText) {
    const field = api.createStyledElement("label", "display:block;margin:0 0 10px;");
    field.appendChild(
      api.createStyledElement(
        "span",
        `display:block;margin:0 0 4px;font-size:12px;font-weight:600;color:${MUTED};`,
        labelText,
      ),
    );
    const input = document.createElement("input");
    input.type = "date";
    input.required = true;
    input.style.cssText = `width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid ${SOFT_BORDER};border-radius:8px;font-size:13px;color:${UCD_BLUE};background:#fff;`;
    field.appendChild(input);
    return { field, input };
  }

  function getCourseColor(courseIndex) {
    return COURSE_COLORS[courseIndex % COURSE_COLORS.length];
  }

  function collectGridBlocks(schedule) {
    const blocks = [];
    let minMinutes = 8 * 60;
    let maxMinutes = 18 * 60;

    schedule.courses.forEach((course, courseIndex) => {
      const color = getCourseColor(courseIndex);
      const label = shortCourseLabel(course);

      for (const meeting of course.meetings) {
        const startMinutes = parseTimeToMinutes(meeting.start);
        const endMinutes = parseTimeToMinutes(meeting.end);
        if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
          continue;
        }

        minMinutes = Math.min(minMinutes, startMinutes);
        maxMinutes = Math.max(maxMinutes, endMinutes);

        for (const dayCode of meeting.dayCodes) {
          if (!DAY_ORDER.includes(dayCode)) {
            continue;
          }
          blocks.push({
            dayCode,
            startMinutes,
            endMinutes,
            color,
            label,
            type: meeting.type,
          });
        }
      }
    });

    if (!blocks.length) {
      return { blocks: [], minMinutes: 8 * 60, maxMinutes: 18 * 60 };
    }

    minMinutes = Math.max(7 * 60, Math.floor(minMinutes / 60) * 60 - 30);
    maxMinutes = Math.min(22 * 60, Math.ceil(maxMinutes / 60) * 60 + 30);

    return { blocks, minMinutes, maxMinutes };
  }

  function createLogoButtonContent(label, logoSize = 16) {
    const wrap = document.createDocumentFragment();
    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("128.png");
    logo.alt = "";
    logo.style.cssText = `width:${logoSize}px;height:${logoSize}px;border-radius:4px;object-fit:cover;display:block;flex-shrink:0;`;
    logo.addEventListener(
      "error",
      () => {
        const fallback = api.createStyledElement(
          "span",
          "display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#01256e;color:#ffbf00;font:700 10px system-ui;flex-shrink:0;",
          "A",
        );
        logo.replaceWith(fallback);
      },
      { once: true },
    );
    wrap.append(logo, document.createTextNode(label));
    return wrap;
  }

  function collectFinalEntries(schedule) {
    const entries = [];
    schedule.courses.forEach((course, courseIndex) => {
      const title = api.formatCalendarEventTitle(course);
      const color = getCourseColor(courseIndex);
      if (course.finalExam?.date && course.finalExam?.time) {
        const finalParts = ICS.parseUsDateTime(
          course.finalExam.date,
          course.finalExam.time,
        );
        entries.push({
          title,
          color,
          date: course.finalExam.date,
          time: course.finalExam.time,
          sortKey: finalParts ? ICS.partsSortKey(finalParts) : Number.MAX_SAFE_INTEGER,
          raw: null,
        });
      } else if (course.finalExam?.raw) {
        entries.push({
          title,
          color,
          date: null,
          time: null,
          sortKey: Number.MAX_SAFE_INTEGER,
          raw: course.finalExam.raw,
        });
      }
    });
    return entries.sort((a, b) => a.sortKey - b.sortKey);
  }

  function formatFinalSummary(course) {
    if (course.finalExam?.date && course.finalExam?.time) {
      return `${course.finalExam.date} · ${course.finalExam.time}`;
    }
    if (course.finalExam?.raw) {
      return course.finalExam.raw;
    }
    return null;
  }

  function buildFinalsNote(schedule, bounds) {
    const wrap = api.createStyledElement(
      "div",
      `margin-top:10px;padding:8px 10px;background:#fff;border:1px solid ${SOFT_BORDER};border-radius:8px;`,
    );

    const header = api.createStyledElement(
      "div",
      `margin:0 0 5px;font-size:12px;font-weight:700;color:${UCD_BLUE};`,
      bounds?.finalExaminations
        ? `Final exams · week of ${bounds.finalExaminations}`
        : "Final exams",
    );
    wrap.appendChild(header);

    const entries = collectFinalEntries(schedule);
    if (!entries.length) {
      wrap.appendChild(
        api.createStyledElement(
          "p",
          `margin:0;font-size:11px;color:${MUTED};line-height:1.4;`,
          "No final times found on course cards.",
        ),
      );
      return wrap;
    }

    const list = api.createStyledElement("div", "display:grid;gap:3px;");
    for (const entry of entries) {
      const line = api.createStyledElement(
        "div",
        "display:flex;gap:6px;align-items:baseline;font-size:12px;line-height:1.4;",
      );
      line.append(
        api.createStyledElement(
          "span",
          `width:6px;height:6px;border-radius:50%;background:${entry.color};flex-shrink:0;transform:translateY(-1px);`,
        ),
        api.createStyledElement(
          "span",
          `flex:0 0 auto;font-weight:600;color:${UCD_BLUE};`,
          entry.date && entry.time ? `${entry.date} ${entry.time}` : entry.raw || "TBD",
        ),
        api.createStyledElement(
          "span",
          `flex:1;min-width:0;color:${MUTED};`,
          entry.title,
        ),
      );
      list.appendChild(line);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function buildListPreview(schedule, bounds) {
    const wrap = api.createStyledElement("div", "display:grid;gap:6px;");

    if (!schedule.courses.length) {
      wrap.appendChild(
        api.createStyledElement(
          "div",
          `padding:12px;text-align:center;color:${MUTED};font-size:12px;`,
          "No registered or waitlisted courses to export.",
        ),
      );
      return wrap;
    }

    schedule.courses.forEach((course, courseIndex) => {
      const color = getCourseColor(courseIndex);
      const title = api.formatCalendarEventTitle(course);
      const finalSummary = formatFinalSummary(course);
      const card = api.createStyledElement(
        "article",
        `background:#fff;border:1px solid ${SOFT_BORDER};border-left:3px solid ${color};border-radius:8px;padding:8px 10px;`,
      );

      card.appendChild(
        api.createStyledElement(
          "h3",
          `margin:0 0 4px;font-size:12px;font-weight:700;color:${UCD_BLUE};line-height:1.25;`,
          title,
        ),
      );

      if (!course.meetings.length && course.skippedAsync) {
        card.appendChild(
          api.createStyledElement(
            "p",
            `margin:0 0 3px;font-size:11px;color:${MUTED};`,
            "Async virtual lecture — no fixed meeting time",
          ),
        );
      }

      for (const meeting of course.meetings) {
        card.appendChild(
          api.createStyledElement(
            "p",
            `margin:0 0 2px;font-size:11px;color:${MUTED};line-height:1.35;`,
            `${meeting.type}: ${formatMeetingSummary(meeting)}`,
          ),
        );
      }

      if (finalSummary) {
        card.appendChild(
          api.createStyledElement(
            "p",
            `margin:${course.meetings.length ? "4px" : "0"} 0 0;font-size:11px;color:${UCD_BLUE};line-height:1.35;`,
            `Final: ${finalSummary}`,
          ),
        );
      }

      wrap.appendChild(card);
    });

    return wrap;
  }

  function buildCalendarPreview(schedule, bounds) {
    const wrap = api.createStyledElement("div", "");

    const hasTimedMeetings = schedule.courses.some((course) =>
      course.meetings.some(
        (meeting) =>
          meeting.dayCodes.length && parseTimeToMinutes(meeting.start) != null,
      ),
    );

    if (!hasTimedMeetings) {
      wrap.appendChild(
        api.createStyledElement(
          "div",
          `padding:12px;text-align:center;color:${MUTED};font-size:12px;background:#fff;border:1px solid ${SOFT_BORDER};border-radius:8px;`,
          schedule.courses.some((c) => c.skippedAsync)
            ? "No fixed weekly meeting times — see List for course details."
            : "No weekly meeting times to show.",
        ),
      );
    } else {
      wrap.appendChild(buildWeekGrid(schedule));
    }

    wrap.appendChild(buildFinalsNote(schedule, bounds));
    return wrap;
  }

  function buildPreviewTabs(schedule, bounds) {
    const tabs = [
      { id: "list", label: "List" },
      { id: "calendar", label: "Calendar" },
    ];
    let activeTab = "calendar";

    const tabBar = api.createStyledElement(
      "div",
      `display:flex;gap:3px;margin:0 0 8px;padding:3px;background:#fff;border:1px solid ${SOFT_BORDER};border-radius:999px;`,
    );

    const panelHost = api.createStyledElement(
      "div",
      "min-height:180px;max-height:46vh;overflow:auto;",
    );

    function renderPanel() {
      panelHost.replaceChildren();
      if (activeTab === "list") {
        panelHost.appendChild(buildListPreview(schedule, bounds));
      } else {
        panelHost.appendChild(buildCalendarPreview(schedule, bounds));
      }
    }

    function setActiveTab(tabId) {
      activeTab = tabId;
      for (const btn of tabBar.querySelectorAll("button")) {
        const isActive = btn.dataset.tab === tabId;
        btn.style.background = isActive ? UCD_BLUE : "transparent";
        btn.style.color = isActive ? UCD_GOLD : UCD_BLUE;
        btn.style.fontWeight = isActive ? "700" : "600";
      }
      renderPanel();
    }

    for (const tab of tabs) {
      const btn = api.createStyledElement(
        "button",
        [
          "flex:1",
          "padding:5px 8px",
          "border:none",
          "border-radius:999px",
          "font-size:11px",
          "cursor:pointer",
          "transition:background .12s,color .12s",
        ].join(";"),
        tab.label,
      );
      btn.type = "button";
      btn.dataset.tab = tab.id;
      btn.addEventListener("click", () => setActiveTab(tab.id));
      tabBar.appendChild(btn);
    }

    setActiveTab("calendar");

    const root = api.createStyledElement("div", "");
    root.append(tabBar, panelHost);
    return root;
  }

  function buildWeekGrid(schedule) {
    const { blocks, minMinutes, maxMinutes } = collectGridBlocks(schedule);
    const spanMinutes = Math.max(maxMinutes - minMinutes, 60);
    const gridHeightPx = 200;

    const grid = api.createStyledElement(
      "div",
      "display:grid;grid-template-columns:38px repeat(5,minmax(0,1fr));gap:4px;margin:0;",
    );

    const corner = document.createElement("div");
    grid.appendChild(corner);

    for (const dayCode of DAY_ORDER) {
      const head = api.createStyledElement(
        "div",
        "text-align:center;font-size:11px;font-weight:700;color:#64748b;padding:0 0 3px;",
        DAY_LABELS[dayCode],
      );
      grid.appendChild(head);
    }

    const timeCol = api.createStyledElement(
      "div",
      `position:relative;height:${gridHeightPx}px;`,
    );
    for (let hour = Math.ceil(minMinutes / 60); hour <= Math.floor(maxMinutes / 60); hour += 1) {
      const topPct = ((hour * 60 - minMinutes) / spanMinutes) * 100;
      const label = api.createStyledElement(
        "div",
        `position:absolute;left:0;right:0;top:${topPct}%;transform:translateY(-50%);font-size:10px;color:#94a3b8;line-height:1;`,
        formatMinutesLabel(hour * 60),
      );
      timeCol.appendChild(label);
    }
    grid.appendChild(timeCol);

    for (const dayCode of DAY_ORDER) {
      const dayCol = api.createStyledElement(
        "div",
        `position:relative;height:${gridHeightPx}px;background:#fff;border:1px solid ${SOFT_BORDER};border-radius:7px;overflow:hidden;`,
      );

      for (const block of blocks.filter((item) => item.dayCode === dayCode)) {
        const topPct = ((block.startMinutes - minMinutes) / spanMinutes) * 100;
        const heightPct = Math.max(
          ((block.endMinutes - block.startMinutes) / spanMinutes) * 100,
          8,
        );
        const el = api.createStyledElement(
          "div",
          [
            "position:absolute",
            "left:3px",
            "right:3px",
            `top:${topPct}%`,
            `height:${heightPct}%`,
            `background:${block.color}`,
            "color:#fff",
            "border-radius:5px",
            "padding:2px 4px",
            "font-size:9px",
            "font-weight:700",
            "line-height:1.15",
            "overflow:hidden",
            "box-sizing:border-box",
          ].join(";"),
        );
        el.textContent = block.label;
        el.title = `${block.label} (${block.type})`;
        dayCol.appendChild(el);
      }

      grid.appendChild(dayCol);
    }

    return grid;
  }

  function closeExportModal() {
    if (exportModalRoot) {
      exportModalRoot.remove();
      exportModalRoot = null;
    }
  }

  function promptManualQuarterBounds(termName) {
    return new Promise((resolve) => {
      void (async () => {
        closeExportModal();

        const backdrop = api.createStyledElement(
          "div",
          "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483647;",
        );

        const panel = api.createStyledElement(
          "div",
          [
            "position:fixed",
            "top:50%",
            "left:50%",
            "transform:translate(-50%,-50%)",
            "width:min(440px,92vw)",
            "background:#f8fafc",
            `border:1px solid ${SOFT_BORDER}`,
            "border-radius:14px",
            "padding:18px",
            "z-index:2147483648",
            "font:14px Inter,system-ui,sans-serif",
            `color:${UCD_BLUE}`,
          ].join(";"),
        );
        panel.addEventListener("click", (e) => e.stopPropagation());

        panel.append(
          api.createStyledElement(
            "h2",
            `margin:0 0 6px;font-size:17px;color:${UCD_BLUE};`,
            "When does your quarter start / end?",
          ),
          api.createStyledElement(
            "p",
            `margin:0 0 14px;font-size:13px;color:${MUTED};line-height:1.45;`,
            `We couldn't read quarter dates for ${termName} from the registrar. Enter instruction begin and end (Pacific time).`,
          ),
        );

        const { field: startField, input: beginsInput } = createQuarterDateField("Quarter starts");
        const { field: endField, input: endsInput } = createQuarterDateField("Quarter ends");
        panel.append(startField, endField);

        beginsInput.addEventListener("change", () => {
          if (!beginsInput.value) {
            return;
          }
          endsInput.min = beginsInput.value;
          if (endsInput.value && endsInput.value < beginsInput.value) {
            endsInput.value = beginsInput.value;
          }
        });

        const actions = api.createStyledElement(
          "div",
          "display:flex;gap:10px;justify-content:flex-end;margin-top:14px;",
        );
        const cancelBtn = api.createStyledElement(
          "button",
          `padding:8px 14px;border:1px solid ${SOFT_BORDER};border-radius:999px;background:#fff;cursor:pointer;`,
          "Cancel",
        );
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", () => {
          backdrop.remove();
          resolve({ ok: false, error: "Quarter dates required for export." });
        });

        const saveBtn = api.createStyledElement(
          "button",
          `padding:8px 14px;border:none;border-radius:999px;background:${UCD_BLUE};color:${UCD_GOLD};font-weight:700;cursor:pointer;`,
          "Continue",
        );
        saveBtn.type = "button";
        saveBtn.addEventListener("click", () => {
          if (!beginsInput.value || !endsInput.value) {
            return;
          }
          if (beginsInput.value > endsInput.value) {
            return;
          }
          backdrop.remove();
          snipeLog("[calendar_export]", {
            action: "manual_bounds_used",
            termName,
            instructionBeginsIso: beginsInput.value,
            instructionEndsIso: endsInput.value,
          });
          resolve(
            normalizeQuarterBounds(
              {
                ok: true,
                termName,
                source: "manual",
                instructionBeginsIso: beginsInput.value,
                instructionEndsIso: endsInput.value,
              },
              termName,
            ),
          );
        });

        actions.append(cancelBtn, saveBtn);
        panel.appendChild(actions);
        backdrop.appendChild(panel);
        backdrop.addEventListener("click", () => {
          backdrop.remove();
          resolve({ ok: false, error: "Quarter dates required for export." });
        });
        document.body.appendChild(backdrop);
        beginsInput.focus();
      })();
    });
  }

  function showExportModal(schedule, bounds, onComplete) {
    closeExportModal();

    const backdrop = api.createStyledElement(
      "div",
      "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483647;",
    );

    const panel = api.createStyledElement(
      "div",
      [
        "position:fixed",
        "top:50%",
        "left:50%",
        "transform:translate(-50%,-50%)",
        "width:min(500px,94vw)",
        "max-height:82vh",
        "overflow:auto",
        "background:#f8fafc",
        `border:1px solid ${SOFT_BORDER}`,
        "border-radius:12px",
        "box-shadow:0 14px 36px rgba(1,37,110,.18)",
        "z-index:2147483648",
        "padding:14px 14px 12px",
        "font:13px Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
        `color:${UCD_BLUE}`,
      ].join(";"),
    );
    panel.addEventListener("click", (e) => e.stopPropagation());

    const header = api.createStyledElement("header", "margin:0 0 8px;");
    header.append(
      api.createStyledElement(
        "h2",
        `margin:0 0 2px;font-size:16px;line-height:1.2;color:${UCD_BLUE};`,
        `Calendar • ${schedule.termName || "Term"}`,
      ),
      buildExportDateSubtitle(bounds),
    );
    panel.appendChild(header);

    const body = api.createStyledElement("div", "margin:0 0 10px;");

    if (!schedule.courses.length) {
      body.appendChild(
        api.createStyledElement(
          "div",
          `background:#fff;border:1px solid ${SOFT_BORDER};border-radius:10px;padding:16px;text-align:center;color:${MUTED};font-size:13px;`,
          "No registered or waitlisted courses to export.",
        ),
      );
    } else {
      body.appendChild(buildPreviewTabs(schedule, bounds));
    }

    panel.appendChild(body);

    const actions = api.createStyledElement(
      "div",
      "display:flex;flex-direction:column;gap:8px;position:sticky;bottom:0;padding-top:6px;background:linear-gradient(transparent,#f8fafc 30%);",
    );

    let exportFinished = false;
    let exportSucceeded = false;
    const finishExport = (result) => {
      if (exportFinished) {
        return;
      }
      exportFinished = true;
      onComplete?.(result);
    };

    const dismissExportModal = () => {
      if (!exportFinished) {
        finishExport({ ok: false, error: "Export cancelled." });
      }
      closeExportModal();
      if (exportSucceeded) {
        snipeLog("[feedback_prompt]", {
          action: "schedule_after_success",
          reason: "calendar_export",
        });
        window.setTimeout(() => {
          api.maybeShowFeedbackPrompt?.({ reason: "calendar_export" });
        }, 400);
      }
    };

    backdrop.addEventListener("click", dismissExportModal);

    const actionRow = api.createStyledElement(
      "div",
      "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;",
    );

    const cancelBtn = api.createStyledElement(
      "button",
      `padding:6px 12px;border:1px solid ${SOFT_BORDER};border-radius:999px;background:#fff;color:${UCD_BLUE};font-size:12px;font-weight:600;cursor:pointer;`,
      "Cancel",
    );
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", dismissExportModal);

    const downloadBtn = api.createStyledElement(
      "button",
      `padding:6px 12px;border:1px solid ${SOFT_BORDER};border-radius:999px;background:#fff;color:${UCD_BLUE};font-size:12px;font-weight:700;cursor:pointer;`,
      "Download .ics",
    );
    downloadBtn.type = "button";
    downloadBtn.disabled = !schedule.courses.length;

    const googleBtn = api.createStyledElement(
      "button",
      `padding:6px 12px;border:none;border-radius:999px;background:${UCD_BLUE};color:${UCD_GOLD};font-size:12px;font-weight:700;cursor:pointer;`,
      "Download for Google",
    );
    googleBtn.type = "button";
    googleBtn.disabled = !schedule.courses.length;

    const completeExport = (mode) => {
      exportSucceeded = true;
      finishExport({ ok: true, mode, courseCount: schedule.courses.length });
    };

    const showGoogleImportSteps = (filename) => {
      actionRow.hidden = true;

      const steps = api.createStyledElement(
        "div",
        `padding:10px 12px;border:1px solid ${SOFT_BORDER};border-radius:10px;background:#fff;font-size:12px;line-height:1.5;color:${MUTED};`,
      );
      steps.append(
        api.createStyledElement(
          "p",
          `margin:0 0 8px;font-size:13px;font-weight:700;color:${UCD_BLUE};`,
          "Almost there — finish in Google Calendar",
        ),
        api.createStyledElement(
          "p",
          "margin:0 0 6px;",
          `1. Your file ${filename} was downloaded.`,
        ),
        api.createStyledElement(
          "p",
          "margin:0 0 6px;",
          "2. In Google Calendar, go to Settings → Import & export.",
        ),
        api.createStyledElement(
          "p",
          "margin:0 0 12px;",
          "3. Under Import, choose that .ics file, pick a calendar, and click Import.",
        ),
      );

      const stepActions = api.createStyledElement(
        "div",
        "display:flex;flex-wrap:wrap;gap:8px;align-items:center;",
      );

      const openImportBtn = api.createStyledElement(
        "button",
        `padding:6px 12px;border:none;border-radius:999px;background:${UCD_BLUE};color:${UCD_GOLD};font-size:12px;font-weight:700;cursor:pointer;`,
        "Open Google Calendar import",
      );
      openImportBtn.type = "button";
      openImportBtn.addEventListener("click", () => {
        const importTab = window.open(
          GOOGLE_CALENDAR_IMPORT_URL,
          "_blank",
          "noopener,noreferrer",
        );
        snipeLog("[calendar_export]", {
          action: "google_calendar_import_opened",
          filename,
          importTabOpened: !!importTab,
        });
      });

      const downloadAgainBtn = api.createStyledElement(
        "button",
        `padding:6px 12px;border:1px solid ${SOFT_BORDER};border-radius:999px;background:#fff;color:${UCD_BLUE};font-size:12px;font-weight:700;cursor:pointer;`,
        "Download .ics again",
      );
      downloadAgainBtn.type = "button";
      downloadAgainBtn.addEventListener("click", () => {
        const events = buildIcsEvents(schedule, bounds);
        if (!events.length) {
          showExportError(
            "Could not rebuild the .ics file. Reload the page and try again.",
          );
          return;
        }
        downloadIcsFile(schedule, ICS.buildIcs(events));
        snipeLog("[calendar_export]", { action: "downloaded_again", filename });
      });

      stepActions.append(openImportBtn, downloadAgainBtn);
      steps.appendChild(stepActions);

      const doneBtn = api.createStyledElement(
        "button",
        `align-self:flex-end;padding:6px 12px;border:1px solid ${SOFT_BORDER};border-radius:999px;background:#fff;color:${UCD_BLUE};font-size:12px;font-weight:600;cursor:pointer;`,
        "Done",
      );
      doneBtn.type = "button";
      doneBtn.addEventListener("click", dismissExportModal);

      actions.append(steps, doneBtn);
    };

    let exportErrorEl = null;
    const showExportError = (message) => {
      exportErrorEl?.remove();
      exportErrorEl = api.createStyledElement(
        "p",
        "margin:0;padding:8px 10px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:12px;line-height:1.4;",
        message,
      );
      actions.insertBefore(exportErrorEl, actionRow);
    };

    if (schedule.courses.length) {
      const exportIcsFromModal = (mode) => {
        exportErrorEl?.remove();
        exportErrorEl = null;
        const events = buildIcsEvents(schedule, bounds);
        if (!events.length) {
          showExportError(
            "Could not build the .ics file. Reload the page and try again, or enter quarter dates when prompted.",
          );
          snipeLog("[calendar_export]", {
            action: "export_failed",
            mode,
            bounds,
          });
          return null;
        }
        const icsText = ICS.buildIcs(events);
        const filename = getIcsFilename(schedule);
        downloadIcsFile(schedule, icsText);
        snipeLog("[calendar_export]", {
          action: mode === "google" ? "google_calendar_download" : "downloaded",
          filename,
        });
        return filename;
      };

      downloadBtn.addEventListener("click", () => {
        if (!exportIcsFromModal("download")) {
          return;
        }
        completeExport("download");
        dismissExportModal();
      });

      googleBtn.addEventListener("click", () => {
        const filename = exportIcsFromModal("google");
        if (!filename) {
          return;
        }
        completeExport("google");
        showGoogleImportSteps(filename);
      });
    } else {
      downloadBtn.style.opacity = "0.45";
      downloadBtn.style.cursor = "not-allowed";
      googleBtn.style.opacity = "0.45";
      googleBtn.style.cursor = "not-allowed";
    }

    actionRow.append(cancelBtn, downloadBtn, googleBtn);
    actions.append(actionRow);
    panel.appendChild(actions);

    exportModalRoot = api.createStyledElement("div", "");
    exportModalRoot.append(backdrop, panel);
    document.body.appendChild(exportModalRoot);
  }

  function buildIcsEvents(schedule, bounds) {
    const events = [];
    const startBase = bounds.instructionBeginsParts;
    const endDate = bounds.instructionEndsParts;
    if (!startBase || !endDate) {
      snipeLog("[calendar_export]", {
        action: "ics_bounds_invalid",
        bounds,
      });
      return events;
    }

    const uidBase = `ass-${Date.now()}`;

    schedule.courses.forEach((course, courseIndex) => {
      const summary = api.formatCalendarEventTitle(course);
      const description = [
        course.crn ? `CRN: ${course.crn}` : "",
        course.units ? `Units: ${course.units}` : "",
        course.notes || "",
      ]
        .filter(Boolean)
        .join("\n");

      course.meetings.forEach((meeting, meetingIndex) => {
        const occurrenceDate = ICS.firstOccurrenceOnOrAfter(
          startBase,
          meeting.dayCodes[0],
        );
        const start = ICS.parseTimeOnDate(occurrenceDate, meeting.start);
        const end = ICS.parseTimeOnDate(occurrenceDate, meeting.end);
        if (!start || !end) {
          return;
        }
        events.push({
          uid: `${uidBase}-${courseIndex}-${meetingIndex}@ass.vijit.app`,
          start,
          end,
          summary: `${summary} (${meeting.type})`,
          location: meeting.location,
          description,
          rrule: ICS.buildRrule(meeting.dayCodes, endDate),
        });
      });

      if (course.finalExam?.date && course.finalExam?.time) {
        const finalStart = ICS.parseUsDateTime(
          course.finalExam.date,
          course.finalExam.time,
        );
        if (finalStart) {
          events.push({
            uid: `${uidBase}-final-${courseIndex}@ass.vijit.app`,
            start: finalStart,
            end: ICS.addHours(finalStart, 2),
            summary: `FINAL: ${summary}`,
            location: "",
            description,
          });
        }
      }
    });

    return events;
  }

  function getIcsFilename(schedule) {
    const termSlug = ICS.slugify(schedule.termName);
    const scheduleSlug = ICS.slugify(schedule.scheduleName);
    return `ass-${termSlug}-${scheduleSlug}.ics`;
  }

  function buildIcsText(schedule, bounds) {
    return ICS.buildIcs(buildIcsEvents(schedule, bounds));
  }

  function downloadIcsFile(schedule, icsText) {
    const filename = getIcsFilename(schedule);
    const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    snipeLog("[calendar_export]", { action: "downloaded", filename });
  }

  async function prepareCalendarExport() {
    if (window.self !== window.top) {
      return { ok: false, error: "Export only works on the main Schedule Builder page." };
    }

    const schedule = api.parseScheduleFromDom();
    if (!schedule.termName) {
      return { ok: false, error: "Could not read term name from the page." };
    }

    if (!schedule.ok) {
      return { ok: false, error: schedule.error, schedule };
    }

    if (!schedule.courses.length) {
      return { ok: false, error: "No registered or waitlisted courses to export." };
    }

    snipeLog("[calendar_export]", {
      action: "parsed_schedule",
      courseCount: schedule.courses.length,
      finalsFound: schedule.courses.filter(
        (course) => course.finalExam?.date && course.finalExam?.time,
      ).length,
      finalsMissing: schedule.courses
        .filter((course) => !(course.finalExam?.date && course.finalExam?.time))
        .map((course) => ({
          codeSection: course.codeSection,
          finalExam: course.finalExam,
        })),
    });

    const resolvedBounds = await resolveQuarterBounds(schedule.termName);
    if (!resolvedBounds.ok) {
      return { ok: false, error: resolvedBounds.error || "Quarter dates required for export." };
    }

    return { ok: true, schedule, bounds: resolvedBounds };
  }

  async function runDirectCalendarExport(mode = "download") {
    const prepared = await prepareCalendarExport();
    if (!prepared.ok) {
      return prepared;
    }

    const { schedule, bounds } = prepared;
    const events = buildIcsEvents(schedule, bounds);
    if (!events.length) {
      return {
        ok: false,
        error: "Could not build calendar events — check quarter start/end dates.",
      };
    }

    const icsText = ICS.buildIcs(events);
    const filename = getIcsFilename(schedule);
    downloadIcsFile(schedule, icsText);
    snipeLog("[calendar_export]", {
      action: mode === "google" ? "google_calendar_download" : "downloaded",
      filename,
      direct: true,
    });

    if (mode === "google") {
      return { ok: true, mode: "google", filename, importUrl: GOOGLE_CALENDAR_IMPORT_URL };
    }

    return { ok: true, mode: "download", filename };
  }

  async function runCalendarExport() {
    const prepared = await prepareCalendarExport();
    if (!prepared.ok) {
      if (prepared.schedule) {
        showExportModal({ ...prepared.schedule, courses: [] }, null);
      }
      return { ok: false, error: prepared.error };
    }

    const { schedule, bounds } = prepared;
    return new Promise((resolve) => {
      showExportModal(schedule, bounds, (result) => {
        resolve(result || { ok: false, error: "Export cancelled." });
      });
    });
  }

  function normalizeButtonLabel(el) {
    return (el.textContent || el.value || "").replace(/\s+/g, " ").trim();
  }

  function findToolbarViewButton() {
    for (const el of document.querySelectorAll("a, button, input[type='button'], .btn")) {
      if (/^View$/i.test(normalizeButtonLabel(el))) {
        return el;
      }
    }
    return null;
  }

  function removeScheduleBuilderExportButton() {
    document.getElementById("assExportCalendarBtn")?.remove();
  }

  function injectScheduleBuilderExportButton() {
    if (ASS.state.settings.showCalendarExport === false) {
      removeScheduleBuilderExportButton();
      return;
    }

    const viewBtn = findToolbarViewButton();
    if (!viewBtn) {
      return;
    }

    const container = viewBtn.closest(".btn-group") || viewBtn.parentElement;
    if (!container) {
      return;
    }

    let btn = document.getElementById("assExportCalendarBtn");
    if (!btn) {
      btn = createToolbarExportButton();
    }

    if (container.lastElementChild !== btn) {
      container.appendChild(btn);
    }
  }

  function createToolbarExportButton() {
    const btn = api.createStyledElement(
      "button",
      [
        "display:inline-flex",
        "align-items:center",
        "gap:8px",
        "margin:0 0 0 10px",
        "padding:9px 18px",
        "min-height:38px",
        "box-sizing:border-box",
        "border-radius:999px",
        "border:1px solid #d2dbe8",
        "background:#f8fafc",
        `color:${UCD_BLUE}`,
        "font:700 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        "cursor:pointer",
        "vertical-align:middle",
        "white-space:nowrap",
        "box-shadow:0 1px 3px rgba(1,37,110,.12)",
      ].join(";"),
    );
    btn.id = "assExportCalendarBtn";
    btn.type = "button";
    btn.title = "Download your schedule as a .ics file (Aggie Schedule Sniper)";
    btn.appendChild(createLogoButtonContent("Export Calendar", 20));
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void runCalendarExport();
    });
    return btn;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ASS_EXPORT_CALENDAR") {
      void runCalendarExport().then(sendResponse);
      return true;
    }
    if (message?.type === "ASS_DOWNLOAD_ICS") {
      void runDirectCalendarExport(message.mode || "download").then(sendResponse);
      return true;
    }
    return false;
  });

  Object.assign(api, {
    runCalendarExport,
    runDirectCalendarExport,
    injectScheduleBuilderExportButton,
    removeScheduleBuilderExportButton,
  });
})();
