(() => {
  if (window.self !== window.top) {
    return;
  }

  const ASS = window.ASS;
  const { api } = ASS;
  const core = window.ASS_SCHEDULER_CORE;
  const CHANNEL = "ASS_AUTO_SCHEDULER_BRIDGE_V1";
  const INPUT_STORAGE_KEY = "assAutoSchedulerCourseInput";
  const pendingRequests = new Map();
  let requestCounter = 0;
  let root = null;
  let refs = null;
  let groups = [];
  let generatedResult = null;
  let busy = false;
  let dataReady = false;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      message?.channel !== CHANNEL ||
      message?.direction !== "response" ||
      !pendingRequests.has(message.id)
    ) {
      return;
    }
    const pending = pendingRequests.get(message.id);
    if (message.kind === "progress") {
      pending.onProgress?.(message.payload);
      return;
    }
    clearTimeout(pending.timer);
    pendingRequests.delete(message.id);
    pending.resolve(message.payload || { ok: false, error: "Empty page response" });
  });

  function pageRequest(action, payload, onProgress) {
    return new Promise((resolve) => {
      requestCounter += 1;
      const id = `${Date.now()}-${requestCounter}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        resolve({ ok: false, error: "Schedule Builder request timed out." });
      }, 180000);
      pendingRequests.set(id, { resolve, timer, onProgress });
      window.postMessage(
        { channel: CHANNEL, direction: "request", id, action, payload },
        window.location.origin,
      );
    });
  }

  function ensureStyles() {
    if (document.getElementById("ass-auto-scheduler-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ass-auto-scheduler-styles";
    style.textContent = `
      .ass-planner{margin:18px 0;border:1px solid #d9e2f0;border-top:5px solid #ffbf00;border-radius:14px;background:#fff;box-shadow:0 10px 28px rgba(1,37,110,.09);color:#172033;font:400 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}
      .ass-planner *{box-sizing:border-box}
      .ass-planner__head{padding:18px 20px;background:linear-gradient(135deg,#01256e,#123f91);color:#fff}
      .ass-planner__title{margin:0;font-size:20px;font-weight:800}.ass-planner__subtitle{margin:5px 0 0;color:#dbeafe;line-height:1.45}
      .ass-planner__body{padding:18px 20px}.ass-planner__label{display:block;margin-bottom:7px;font-weight:750;color:#01256e}
      .ass-planner__input{display:block;width:100%;min-height:82px;padding:11px 12px;border:1px solid #aebbd0;border-radius:10px;resize:vertical;font:500 14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#172033;background:#fff}
      .ass-planner__input:focus{outline:3px solid rgba(255,191,0,.28);border-color:#a77800}
      .ass-planner__hint{margin:7px 0 0;color:#667085;font-size:12px}.ass-planner__actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px}
      .ass-planner__btn{appearance:none;border:1px solid #01256e;border-radius:9px;padding:9px 13px;background:#fff;color:#01256e;font-weight:750;cursor:pointer;line-height:1.25}
      .ass-planner__btn:hover:not(:disabled){background:#eef4ff}.ass-planner__btn--primary{background:#01256e;color:#fff}.ass-planner__btn--primary:hover:not(:disabled){background:#123f91}
      .ass-planner__btn--gold{border-color:#bd8700;background:#ffbf00;color:#172033}.ass-planner__btn--gold:hover:not(:disabled){background:#ffd24d}
      .ass-planner__btn:disabled{opacity:.48;cursor:not-allowed}.ass-planner__status{display:none;margin:14px 0 0;padding:10px 12px;border-radius:9px;background:#eff6ff;color:#1e3a8a;line-height:1.45}
      .ass-planner__status--error{display:block;background:#fff1f2;color:#9f1239}.ass-planner__status--success{display:block;background:#ecfdf3;color:#166534}.ass-planner__status--info{display:block}
      .ass-planner__courses{display:grid;gap:12px;margin-top:16px}.ass-planner__course{border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;background:#fbfdff}
      .ass-planner__course-head{padding:11px 13px;background:#edf3fb;color:#01256e;font-size:15px;font-weight:800}.ass-planner__course-meta{margin-left:6px;color:#64748b;font-size:12px;font-weight:600}
      .ass-planner__professors{display:grid;gap:8px;padding:10px}.ass-planner__professor{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid #e5eaf1;border-radius:9px;background:#fff;cursor:pointer}
      .ass-planner__professor:hover{border-color:#9aabc5}.ass-planner__professor:has(input:checked){border-color:#01256e;box-shadow:0 0 0 2px rgba(1,37,110,.12)}.ass-planner__professor input{margin-top:3px}
      .ass-planner__prof-main{min-width:0;flex:1}.ass-planner__prof-name{font-weight:800;color:#172033}.ass-planner__prof-stats{margin-top:3px;color:#526071;font-size:12px;line-height:1.45}
      .ass-planner__pill{display:inline-flex;margin:4px 5px 0 0;padding:2px 7px;border-radius:999px;background:#eef2f7;color:#475569;font-size:11px;font-weight:700}.ass-planner__pill--open{background:#dcfce7;color:#166534}.ass-planner__pill--wait{background:#fff1d6;color:#92400e}.ass-planner__pill--closed{background:#ffe4e6;color:#9f1239}
      .ass-planner__output{margin-top:18px;padding-top:17px;border-top:2px solid #e8edf5}.ass-planner__output[hidden]{display:none}.ass-planner__output h3{margin:0 0 10px;color:#01256e;font-size:17px}
      .ass-planner__warning{margin:8px 0;padding:11px 12px;border:2px solid #f59e0b;border-radius:9px;background:#fffbeb;color:#78350f;font-weight:750}.ass-planner__warning--danger{border-color:#e11d48;background:#fff1f2;color:#881337}
      .ass-planner__table-wrap{overflow-x:auto}.ass-planner__table{width:100%;border-collapse:collapse;font-size:12px}.ass-planner__table th,.ass-planner__table td{padding:9px 8px;border-bottom:1px solid #e5eaf1;text-align:left;vertical-align:top}.ass-planner__table th{background:#f4f7fb;color:#344054;white-space:nowrap}.ass-planner__meetings{min-width:240px;line-height:1.5}.ass-planner__save-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:12px}
      @media (max-width:700px){.ass-planner__body,.ass-planner__head{padding:15px}.ass-planner__actions{flex-direction:column}.ass-planner__btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, tone) {
    if (!refs) {
      return;
    }
    refs.status.textContent = message || "";
    refs.status.className = `ass-planner__status${message ? ` ass-planner__status--${tone || "info"}` : ""}`;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    if (!root) {
      return;
    }
    for (const button of root.querySelectorAll("button[data-ass-action]")) {
      button.disabled = nextBusy || (button.dataset.requiresData === "1" && !dataReady);
    }
  }

  function instructorSections(group, displayName) {
    return group.sections.filter((section) =>
      section.instructors.some((instructor) => instructor.displayName === displayName),
    );
  }

  function uniqueInstructors(group) {
    const byName = new Map();
    for (const section of group.sections) {
      for (const instructor of section.instructors) {
        if (!byName.has(instructor.displayName)) {
          byName.set(instructor.displayName, instructor);
        }
      }
    }
    return [...byName.values()].sort((a, b) => {
      const ratingA = Number(a.rmp?.rating ?? -1);
      const ratingB = Number(b.rmp?.rating ?? -1);
      return ratingB - ratingA || a.displayName.localeCompare(b.displayName);
    });
  }

  function pill(text, tone) {
    const node = document.createElement("span");
    node.className = `ass-planner__pill${tone ? ` ass-planner__pill--${tone}` : ""}`;
    node.textContent = text;
    return node;
  }

  function renderCourseChoices() {
    refs.courses.replaceChildren();
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const card = document.createElement("section");
      card.className = "ass-planner__course";
      const header = document.createElement("div");
      header.className = "ass-planner__course-head";
      header.textContent = `${group.courseKey}${group.title ? ` — ${group.title}` : ""}`;
      const meta = document.createElement("span");
      meta.className = "ass-planner__course-meta";
      meta.textContent = `${group.sections.length} sections`;
      header.appendChild(meta);
      const list = document.createElement("div");
      list.className = "ass-planner__professors";

      for (const instructor of uniqueInstructors(group)) {
        const sections = instructorSections(group, instructor.displayName);
        const nonConflicting = sections.filter(
          (section) => !section.existingScheduleConflict,
        );
        const open = nonConflicting.filter((section) => section.availability === "open").length;
        const waitlist = nonConflicting.filter((section) => section.availability === "waitlist").length;
        const unavailable = nonConflicting.filter(
          (section) => section.availability === "unavailable",
        ).length;
        const unknown = nonConflicting.filter(
          (section) => section.availability === "unknown",
        ).length;
        const conflicts = sections.filter(
          (section) => section.existingScheduleConflict,
        ).length;
        const eligible = open + waitlist + unknown;
        const label = document.createElement("label");
        label.className = "ass-planner__professor";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `ass-professor-${groupIndex}`;
        radio.value = instructor.displayName;
        radio.dataset.courseKey = group.courseKey;
        radio.disabled = eligible === 0;
        const main = document.createElement("span");
        main.className = "ass-planner__prof-main";
        const name = document.createElement("span");
        name.className = "ass-planner__prof-name";
        name.textContent = instructor.displayName;
        const stats = document.createElement("div");
        stats.className = "ass-planner__prof-stats";
        stats.textContent = core.formatRmp(instructor);
        main.append(name, stats);
        if (open) main.appendChild(pill(`${open} Open`, "open"));
        if (waitlist) main.appendChild(pill(`${waitlist} Waitlist only`, "wait"));
        if (unknown) main.appendChild(pill(`${unknown} seat status unknown`));
        if (unavailable) main.appendChild(pill(`${unavailable} excluded (0/0)`, "closed"));
        if (conflicts) {
          main.appendChild(pill(`${conflicts} conflict with current schedule`, "closed"));
        }
        label.append(radio, main);
        list.appendChild(label);
      }
      card.append(header, list);
      refs.courses.appendChild(card);
    }
  }

  async function loadRatings() {
    const names = new Set();
    for (const group of groups) {
      for (const section of group.sections) {
        for (const instructor of section.instructors) {
          if (!/^(TBA|Staff)$/i.test(instructor.displayName)) {
            names.add(instructor.displayName);
          }
        }
      }
    }
    const entries = new Map();
    let completed = 0;
    await Promise.all(
      [...names].map(async (name) => {
        const entry = await api.getProfessorRating(name);
        entries.set(name, entry?.miss ? null : entry);
        completed += 1;
        setStatus(`Loading RateMyProfessors: ${completed}/${names.size}…`, "info");
      }),
    );
    for (const group of groups) {
      for (const section of group.sections) {
        for (const instructor of section.instructors) {
          instructor.rmp = entries.get(instructor.displayName) || null;
        }
      }
    }
  }

  async function collectCourses() {
    if (busy) {
      return;
    }
    const codes = core.parseCourseCodes(refs.input.value);
    if (!codes.length) {
      setStatus("No courses were recognized. Use a format such as CHE002A, CHE 002A, or MAT 021A.", "error");
      refs.input.focus();
      return;
    }
    setBusy(true);
    groups = [];
    generatedResult = null;
    dataReady = false;
    refs.output.hidden = true;
    refs.courses.replaceChildren();
    const missing = [];
    try {
      for (let index = 0; index < codes.length; index += 1) {
        const code = codes[index];
        setStatus(`Searching ${code} (${index + 1}/${codes.length})…`, "info");
        const response = await pageRequest(
          "search_courses",
          { query: code },
          (progress) => {
            if (progress?.stage === "seats") {
              setStatus(
                `Loading live Open/Waitlist data for ${code}: ${progress.completed}/${progress.total}…`,
                "info",
              );
            }
          },
        );
        if (!response.ok) {
          throw new Error(`${code}: ${response.error || "Search failed"}`);
        }
        const byCrn = new Map();
        for (const raw of response.results || []) {
          const section = core.normalizeSearchResult(raw);
          const sectionKey = section.saveKey || section.crn;
          if (section.courseKey === code && !byCrn.has(sectionKey)) {
            byCrn.set(sectionKey, section);
          }
        }
        const sections = [...byCrn.values()];
        if (!sections.length) {
          missing.push(code);
          continue;
        }
        groups.push({
          courseKey: code,
          title: sections[0].title,
          sections,
        });
      }

      if (groups.length) {
        await loadRatings();
        renderCourseChoices();
        chrome.storage.local.set({ [INPUT_STORAGE_KEY]: refs.input.value });
      }
      if (missing.length) {
        setStatus(
          `Loaded ${groups.length} courses, but could not find: ${missing.join(", ")}. Check whether they are offered in the current term.`,
          "error",
        );
      } else {
        dataReady = groups.length === codes.length;
        const sectionCount = groups.reduce((sum, group) => sum + group.sections.length, 0);
        setStatus(
          `Done: ${groups.length} courses and ${sectionCount} sections. Choose one professor per course or use rating-optimized scheduling. Sections that conflict with your current Schedule are excluded.`,
          "success",
        );
      }
    } catch (error) {
      setStatus(`Failed to load courses: ${error?.message || String(error)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function selectedInstructors() {
    const selected = new Map();
    for (const input of refs.courses.querySelectorAll("input[type='radio']:checked")) {
      selected.set(input.dataset.courseKey, input.value);
    }
    return selected;
  }

  function appendWarning(message, danger) {
    const warning = document.createElement("div");
    warning.className = `ass-planner__warning${danger ? " ass-planner__warning--danger" : ""}`;
    warning.textContent = message;
    refs.warnings.appendChild(warning);
  }

  function renderSchedule(result, autoRatings) {
    refs.warnings.replaceChildren();
    refs.scheduleTableBody.replaceChildren();
    if (result.hasWaitlist) {
      appendWarning(
        "Important: this plan contains a section with Open 0 that is available only through the waitlist. Saving it does not guarantee a seat. Keep a backup plan and monitor your waitlist position.",
        true,
      );
    }
    if (result.hasUnknownSeats) {
      appendWarning("Live seat data could not be loaded for some sections. Verify them in Schedule Builder before saving or registering.", false);
    }
    if (result.hasTbaMeetings) {
      appendWarning("Some meeting times are TBA, so conflicts involving those unknown times cannot be verified yet.", false);
    }
    if (result.truncated) {
      appendWarning("The search space was very large. This is the best conflict-free plan found so far, but it may not be the global rating optimum.", false);
    }

    for (const section of result.schedule) {
      const row = document.createElement("tr");
      const values = [
        section.courseKey,
        section.section,
        section.crn,
        section.selectedInstructor?.displayName || "TBA",
        section.selectedRating == null ? "N/A" : `${section.selectedRating.toFixed(1)}/5`,
        core.formatAvailability(section),
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
      const meetingsCell = document.createElement("td");
      meetingsCell.className = "ass-planner__meetings";
      meetingsCell.textContent = section.meetings.length
        ? section.meetings.map(core.formatMeeting).join("\n")
        : "TBA";
      meetingsCell.style.whiteSpace = "pre-line";
      row.appendChild(meetingsCell);
      refs.scheduleTableBody.appendChild(row);
    }
    refs.outputTitle.textContent = autoRatings
      ? "Rating-optimized conflict-free plan"
      : "Conflict-free plan for selected professors";
    refs.output.hidden = false;
    refs.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function refreshExistingScheduleConflicts() {
    const sections = groups.flatMap((group) => group.sections);
    const response = await pageRequest("check_existing_conflicts", {
      courseKeys: sections.map((section) => section.saveKey || section.crn),
    });
    if (!response.ok) {
      throw new Error(response.error || "Could not check the current Schedule for conflicts.");
    }
    const conflictByKey = new Map();
    for (const result of response.results || []) {
      if (!result.ok) {
        throw new Error(result.error || "Course data is no longer available; search again.");
      }
      conflictByKey.set(result.courseKey, result);
    }
    for (const section of sections) {
      const key = section.saveKey || section.crn;
      const result = conflictByKey.get(key);
      if (!result) {
        throw new Error(`Could not verify current-schedule conflicts for ${section.section}.`);
      }
      section.existingScheduleConflict = result.conflict === true;
      section.existingScheduleConflictText = normalizeText(result.text);
    }
  }

  function restoreInstructorSelections(selections) {
    for (const input of refs.courses.querySelectorAll("input[type='radio']")) {
      input.checked = selections.get(input.dataset.courseKey) === input.value;
    }
  }

  async function generate(autoRatings) {
    if (!groups.length || busy) {
      return;
    }
    const selections = selectedInstructors();
    generatedResult = null;
    refs.output.hidden = true;
    setBusy(true);
    setStatus("Rechecking every section against your current Schedule…", "info");
    try {
      await refreshExistingScheduleConflicts();
      renderCourseChoices();
      restoreInstructorSelections(selections);
      const result = core.generateSchedule(groups, {
        autoRatings,
        selections,
      });
      if (!result.ok) {
        const messages = {
          missing_instructor: `Choose a professor for ${result.courseKey} first.`,
          no_eligible_sections: result.instructor
            ? `${result.courseKey} has no eligible section with ${result.instructor}. Sections with 0/0 seats or conflicts with your current Schedule are excluded.`
            : `${result.courseKey} has no eligible section. Sections with 0/0 seats or conflicts with your current Schedule are excluded.`,
          no_conflict_free_schedule: "No plan covers every requested course without conflicts between the requested courses and your current Schedule. Try different professors or copy the GPT prompt for a more personalized analysis.",
        };
        setStatus(messages[result.reason] || "A schedule could not be generated.", "error");
        return;
      }
      generatedResult = result;
      renderSchedule(result, autoRatings);
      setStatus(
        result.hasWaitlist
          ? "Generated a plan with no known class-time conflicts between requested courses or with your current Schedule. It contains a waitlist-only section; review the red warning."
          : "Generated a plan with no known class-time conflicts between requested courses or with your current Schedule. You can now save it to Schedule Builder.",
        result.hasWaitlist ? "error" : "success",
      );
    } catch (error) {
      setStatus(`Conflict check failed: ${error?.message || String(error)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveGeneratedSchedule() {
    if (!generatedResult?.ok || busy) {
      return;
    }
    setBusy(true);
    setStatus("Rechecking this plan against your current Schedule before saving…", "info");
    try {
      await refreshExistingScheduleConflicts();
      const conflictingKeys = new Set(
        groups
          .flatMap((group) => group.sections)
          .filter((section) => section.existingScheduleConflict)
          .map((section) => section.saveKey || section.crn),
      );
      const newlyConflicting = generatedResult.schedule.find((section) =>
        conflictingKeys.has(section.saveKey || section.crn),
      );
      if (newlyConflicting) {
        generatedResult = null;
        refs.output.hidden = true;
        renderCourseChoices();
        throw new Error(
          `${newlyConflicting.section} now conflicts with your current Schedule. Generate a new plan.`,
        );
      }
      if (
        generatedResult.hasWaitlist &&
        !window.confirm(
          "This plan contains a waitlist-only course. Do you still want to save it to the current Schedule Builder schedule?",
        )
      ) {
        setStatus("Save canceled.", "info");
        return;
      }
      setStatus("Saving the selected sections to the current Schedule Builder schedule…", "info");
      const response = await pageRequest("save_courses", {
        crns: generatedResult.schedule.map((section) => section.saveKey || section.crn),
      });
      if (!response.ok) {
        throw new Error(response.error || "Save failed");
      }
      const failed = (response.results || []).filter((item) => !item.ok);
      if (failed.length) {
        setStatus(
          `Some courses could not be saved: ${failed.map((item) => `${item.crn} (${item.error})`).join("; ")}`,
          "error",
        );
      } else {
        setStatus("The plan was saved to the current Schedule Builder schedule. Recheck seats, prerequisites, and final exams before registering.", "success");
      }
    } catch (error) {
      setStatus(`Save failed: ${error?.message || String(error)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function currentTermName() {
    return normalizeText(
      document.querySelector("#termCode1 option:checked")?.textContent ||
        document.querySelector("input[name='termCode']")?.value,
    );
  }

  async function copyPrompt() {
    if (!groups.length || busy) {
      return;
    }
    const selections = selectedInstructors();
    setBusy(true);
    setStatus("Refreshing current-schedule conflicts for the GPT prompt…", "info");
    try {
      await refreshExistingScheduleConflicts();
      renderCourseChoices();
      restoreInstructorSelections(selections);
      const prompt = core.buildPrompt(groups, currentTermName());
      const copied = await window.ASS_CLIPBOARD.copyText(prompt);
      setStatus(
        copied
          ? `Copied the GPT prompt (${prompt.length.toLocaleString()} characters). You can paste it directly into ChatGPT.`
          : "Copy failed. Check the browser's clipboard permission.",
        copied ? "success" : "error",
      );
    } catch (error) {
      setStatus(`Could not prepare the GPT prompt: ${error?.message || String(error)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function bindActions() {
    refs.collect.addEventListener("click", collectCourses);
    refs.generateManual.addEventListener("click", () => generate(false));
    refs.generateAuto.addEventListener("click", () => generate(true));
    refs.copyPrompt.addEventListener("click", copyPrompt);
    refs.save.addEventListener("click", saveGeneratedSchedule);
  }

  function createUi() {
    ensureStyles();
    root = document.createElement("section");
    root.id = "ass-auto-scheduler";
    root.className = "ass-planner";
    root.innerHTML = `
      <div class="ass-planner__head">
        <h2 class="ass-planner__title">Smart Schedule Planner</h2>
        <p class="ass-planner__subtitle">Search courses in bulk, compare RateMyProfessors data, exclude 0/0 and current-schedule conflicts, and generate a conflict-free plan.</p>
      </div>
      <div class="ass-planner__body">
        <label class="ass-planner__label" for="ass-planner-input">All courses you want to take</label>
        <textarea id="ass-planner-input" class="ass-planner__input" placeholder="CHE002A, MAT 021A&#10;You can also enter one course per line"></textarea>
        <p class="ass-planner__hint">Course codes work with or without spaces. The planner uses the current term, live seats, and your current Schedule.</p>
        <div class="ass-planner__actions">
          <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="collect">Search All Courses & Professors</button>
          <button type="button" class="ass-planner__btn" data-ass-action="manual" data-requires-data="1" disabled>Plan with Selected Professors</button>
          <button type="button" class="ass-planner__btn ass-planner__btn--gold" data-ass-action="auto" data-requires-data="1" disabled>Auto-Plan by Rating</button>
          <button type="button" class="ass-planner__btn" data-ass-action="copy" data-requires-data="1" disabled>Copy GPT Scheduling Prompt</button>
        </div>
        <div class="ass-planner__status" role="status" aria-live="polite"></div>
        <div class="ass-planner__courses"></div>
        <section class="ass-planner__output" hidden>
          <h3></h3>
          <div class="ass-planner__warnings"></div>
          <div class="ass-planner__table-wrap">
            <table class="ass-planner__table">
              <thead><tr><th>Course</th><th>Section</th><th>CRN</th><th>Professor</th><th>RMP</th><th>Seats</th><th>Meetings</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="ass-planner__save-row">
            <button type="button" class="ass-planner__btn ass-planner__btn--primary" data-ass-action="save">Save This Plan to Schedule Builder</button>
            <span class="ass-planner__hint">This saves courses only. It never clicks Register for you.</span>
          </div>
        </section>
      </div>
    `;
    refs = {
      input: root.querySelector("#ass-planner-input"),
      collect: root.querySelector("[data-ass-action='collect']"),
      generateManual: root.querySelector("[data-ass-action='manual']"),
      generateAuto: root.querySelector("[data-ass-action='auto']"),
      copyPrompt: root.querySelector("[data-ass-action='copy']"),
      save: root.querySelector("[data-ass-action='save']"),
      status: root.querySelector(".ass-planner__status"),
      courses: root.querySelector(".ass-planner__courses"),
      output: root.querySelector(".ass-planner__output"),
      outputTitle: root.querySelector(".ass-planner__output h3"),
      warnings: root.querySelector(".ass-planner__warnings"),
      scheduleTableBody: root.querySelector(".ass-planner__table tbody"),
    };
    bindActions();
    chrome.storage.local.get([INPUT_STORAGE_KEY], (stored) => {
      if (stored?.[INPUT_STORAGE_KEY]) {
        refs.input.value = stored[INPUT_STORAGE_KEY];
      }
    });
    return root;
  }

  function ensureAutoSchedulerUi() {
    if (root && document.contains(root)) {
      return;
    }
    if (root) {
      root = null;
      refs = null;
      groups = [];
      generatedResult = null;
      dataReady = false;
    }
    const searchHost = document.getElementById("InlineSearchContainer");
    if (!searchHost) {
      return;
    }
    const inlineForm = searchHost.querySelector("#inline_course_search_form");
    if (inlineForm) {
      inlineForm.insertAdjacentElement("afterend", createUi());
    } else {
      searchHost.prepend(createUi());
    }
  }

  Object.assign(api, { ensureAutoSchedulerUi });
})();
