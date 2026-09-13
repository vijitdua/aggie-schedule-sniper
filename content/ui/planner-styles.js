(() => {
  const ASS = window.ASS;

  /**
   * Advanced Planner stylesheet. Tokens match popup.css and the calendar
   * export: UCD blue #01256e, gold #ffbf00, soft border #dce2ea, muted #51627d.
   */
  ASS.plannerStyles = `
.ass-planner-backdrop[hidden] { display: none; }
.ass-planner-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.65);
  font: 13px Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #01256e;
}
.ass-planner {
  position: relative;
  width: min(920px, 100%);
  height: auto;
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  border: 1px solid #dce2ea;
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: 0 14px 36px rgba(1, 37, 110, 0.18);
  overflow: hidden;
}
.ass-planner * { box-sizing: border-box; }
.ass-planner__head {
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px 12px;
  background: #fff;
  border-bottom: 1px solid #dce2ea;
}
.ass-planner__brand { min-width: 0; }
.ass-planner__brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ass-planner__logo {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(1, 37, 110, 0.12);
}
.ass-planner__title { margin: 0; font-size: 16px; font-weight: 700; }
.ass-planner__subtitle {
  margin: 6px 0 0;
  max-width: 66ch;
  color: #51627d;
  font-size: 12px;
  line-height: 1.45;
}
.ass-planner__subtitle-em {
  font-style: italic;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.ass-planner__via {
  display: inline-block;
  margin-top: 6px;
  color: #01256e;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}
.ass-planner__via:hover { text-decoration: underline; }
.ass-planner__close {
  appearance: none;
  border: 0;
  padding: 0 2px;
  background: transparent;
  color: #01256e;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.ass-planner__close:focus-visible,
.ass-planner__btn:focus-visible,
.ass-planner__course-box:focus-visible,
.ass-planner__course-select:focus-visible,
.ass-planner__option:focus-visible,
.ass-planner__suggestion:focus-visible,
.ass-planner__slider:focus-visible {
  outline: 2px solid #ffbf00;
  outline-offset: 2px;
  border-radius: 4px;
}
.ass-planner__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 18px;
  overflow: auto;
}
.ass-planner__label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
}

/* Courses */
.ass-planner__course-field { position: relative; }
.ass-planner__input {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-height: 44px;
  padding: 7px 9px;
  border: 1px solid #dce2ea;
  border-radius: 10px;
  background: #fff;
}
.ass-planner__input:focus-within { border-color: #bd8700; }
.ass-planner__input input {
  flex: 1 1 180px;
  min-width: 150px;
  padding: 5px 3px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #01256e;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
}
.ass-planner__input input::placeholder { color: #94a3b8; }
.ass-planner__chips { display: contents; }
.ass-planner__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px 5px 10px;
  border: 1px solid #dce2ea;
  border-radius: 999px;
  background: #edf3fb;
  font-size: 12px;
  font-weight: 700;
}
.ass-planner__chip-remove {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: #64748b;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.ass-planner__suggestions {
  position: absolute;
  z-index: 5;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  max-height: min(420px, 50vh);
  overflow: auto;
  border: 1px solid #dce2ea;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(1, 37, 110, 0.14);
}
.ass-planner__suggestions[hidden] { display: none; }
.ass-planner__suggestion {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  color: #01256e;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ass-planner__suggestion:last-child { border-bottom: 0; }
.ass-planner__suggestion:hover,
.ass-planner__suggestion.is-active { background: #eef4ff; }
.ass-planner__suggestion-code { display: block; font-weight: 700; }
.ass-planner__suggestion-title {
  display: block;
  margin-top: 2px;
  color: #51627d;
  font-size: 12px;
}
.ass-planner__suggestion-note { padding: 11px 12px; color: #51627d; font-size: 12px; }

/* Preference steps */
.ass-planner__step-count {
  margin: 0;
  color: #51627d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ass-planner__question { margin: 6px 0 0; font-size: 18px; }
.ass-planner__sliders {
  margin-top: 16px;
  padding: 14px 18px 18px;
  border: 1px solid #dce2ea;
  border-radius: 10px;
  background: #fff;
}
.ass-planner__slider-row,
.ass-planner__slider-scale {
  display: grid;
  grid-template-columns: minmax(110px, 190px) minmax(0, 1fr);
  align-items: center;
  gap: 18px;
}
.ass-planner__slider-row { min-height: 40px; }
.ass-planner__slider-row > span { font-size: 13px; font-weight: 650; }
.ass-planner__slider-scale {
  margin-bottom: 2px;
  color: #51627d;
  font-size: 11px;
}
.ass-planner__slider-scale > span:last-child {
  display: flex;
  justify-content: space-between;
}
.ass-planner__slider-wrap { position: relative; height: 26px; }
.ass-planner__slider-rail {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  border-radius: 999px;
  background: #e3e9f1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ass-planner__slider-rail > span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #c3cfe0;
}
.ass-planner__slider {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.ass-planner__slider::-webkit-slider-runnable-track {
  height: 4px;
  background: transparent;
}
.ass-planner__slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #01256e;
  box-shadow: 0 1px 4px rgba(1, 37, 110, 0.4);
}
.ass-planner__balance-scale {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 650;
}
.ass-planner__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: #51627d;
  font-size: 12px;
  cursor: pointer;
}
.ass-planner__note {
  margin: 12px 0 0;
  color: #51627d;
  font-size: 11px;
  line-height: 1.5;
}

/* Results */
.ass-planner__banner {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #f0b429;
  border-radius: 10px;
  background: #fffbeb;
  color: #78350f;
  font-size: 12px;
  font-weight: 650;
}
.ass-planner__banner[hidden] { display: none; }
.ass-planner__results-toolbar {
  position: sticky;
  z-index: 4;
  top: -18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -18px -18px 14px;
  padding: 10px 18px;
  border-bottom: 1px solid #dce2ea;
  background: #fff;
}
.ass-planner__count {
  margin: 0;
  color: #51627d;
  font-size: 12px;
  font-weight: 700;
}
.ass-planner [data-ass-step="results"].is-updating .ass-planner__pinned,
.ass-planner [data-ass-step="results"].is-updating .ass-planner__cards {
  opacity: 0.38;
  pointer-events: none;
}
.ass-planner [data-ass-step="results"].is-updated .ass-planner__pinned,
.ass-planner [data-ass-step="results"].is-updated .ass-planner__cards {
  animation: ass-planner-updated 0.45s ease-out;
}
@keyframes ass-planner-updated {
  0% {
    opacity: 0.45;
    transform: translateY(3px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ass-planner [data-ass-step="results"].is-updated .ass-planner__pinned,
  .ass-planner [data-ass-step="results"].is-updated .ass-planner__cards {
    animation: none;
  }
}
.ass-planner__results-actions { display: flex; gap: 8px; flex: none; flex-wrap: wrap; }
.ass-planner__pinned {
  margin: 0 0 14px;
}
.ass-planner__pinned[hidden] { display: none; }
.ass-planner__selected {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 12px;
  border: 1px solid #01256e;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.ass-planner__selected-head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  background: #01256e;
  color: #fff;
}
.ass-planner__selected-head strong {
  font-size: 12px;
}
.ass-planner__selected-head span {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.8;
}
.ass-planner__selected-cal {
  margin: 0 0 12px 12px;
  border: 1px solid #e5eaf1;
  border-radius: 10px;
  background: #fbfcfe;
  overflow: hidden;
}
.ass-planner__selected-cal .ass-planner__week {
  border-right: 0;
  height: 100%;
}
.ass-planner__selected-courses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  margin: 0 12px 12px 0;
}
.ass-planner__selected .ass-planner__issues {
  grid-column: 1 / -1;
  border: 0;
  border-radius: 8px;
}
.ass-planner__course-box {
  padding: 10px 12px;
  border: 1px solid #dce2ea;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}
.ass-planner__course-box.is-hot {
  border-color: #01256e;
  background: #f8fbff;
}
.ass-planner__course-box.is-selected {
  border-color: #cbd5e1;
  background: #eef2f6;
}
.ass-planner__course-box.is-selected > :not(.ass-planner__course-box-foot) {
  opacity: 0.62;
}
.ass-planner__course-box-head {
  display: flex;
  align-items: center;
  gap: 7px;
}
.ass-planner__course-box-head strong {
  font-size: 13px;
}
.ass-planner__course-box-title {
  margin: 4px 0 8px;
  color: #51627d;
  font-size: 12px;
  line-height: 1.35;
}
.ass-planner__course-box-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.ass-planner__course-box-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.ass-planner__course-box-foot small {
  color: #94a3b8;
  font-size: 10px;
}
.ass-planner__course-box-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ass-planner__course-select {
  appearance: none;
  padding: 3px 8px;
  border: 1px solid #9eb0cb;
  border-radius: 999px;
  background: #fff;
  color: #01256e;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.ass-planner__course-select:hover { background: #eef4ff; }
.ass-planner__course-select.is-selected {
  border-color: #64748b;
  background: #64748b;
  color: #fff;
}
.ass-planner__cards { display: flex; flex-direction: column; gap: 12px; }
.ass-planner__card {
  border: 1px solid #dce2ea;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  cursor: default;
}
.ass-planner__card.is-best { border-color: #9eb0cb; }
.ass-planner__card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
}
.ass-planner__rank { font-size: 13px; font-weight: 700; }
.ass-planner__stats { color: #51627d; font-size: 12px; font-weight: 650; }
.ass-planner__issues {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid #fee2e2;
  background: #fffafa;
}
.ass-planner__issues[hidden] { display: none; }
.ass-planner__card-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 0;
}
.ass-planner__card-courses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  min-width: 0;
}
.ass-planner__week {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 12px 10px 12px 12px;
  border-right: 1px solid #eef2f7;
  background: #fbfcfe;
}
.ass-planner__week-day { min-width: 0; }
.ass-planner__week-label {
  display: block;
  margin-bottom: 4px;
  color: #51627d;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}
.ass-planner__week-track {
  position: relative;
  height: 168px;
  border-radius: 6px;
  background:
    linear-gradient(#eef2f7, #eef2f7) center/100% 1px no-repeat,
    #fff;
  border: 1px solid #e8edf4;
  overflow: hidden;
}
.ass-planner__week-block {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 3px;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.1;
  padding: 2px 1px 0;
  overflow: hidden;
  text-align: center;
  opacity: 0.92;
  transition: opacity 0.12s ease, box-shadow 0.12s ease;
}
.ass-planner__week-block.is-hot {
  opacity: 1;
  box-shadow: 0 0 0 2px rgba(255, 191, 0, 0.9);
  z-index: 2;
}
.ass-planner__week-block.is-locked {
  opacity: 0.4;
  filter: grayscale(0.55);
}
.ass-planner__week-block.is-locked.is-hot { opacity: 0.7; }
.ass-planner__week-block--0 { background: #01256e; }
.ass-planner__week-block--1 { background: #0f766e; }
.ass-planner__week-block--2 { background: #9a3412; }
.ass-planner__week-block--3 { background: #6d28d9; }
.ass-planner__week-block--4 { background: #be185d; }
.ass-planner__week-block--5 { background: #0369a1; }
.ass-planner__swatch {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.ass-planner__swatch--0 { background: #01256e; }
.ass-planner__swatch--1 { background: #0f766e; }
.ass-planner__swatch--2 { background: #9a3412; }
.ass-planner__swatch--3 { background: #6d28d9; }
.ass-planner__swatch--4 { background: #be185d; }
.ass-planner__swatch--5 { background: #0369a1; }
.ass-planner__badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.ass-planner__badge--good { background: #ecfdf5; color: #166534; }
.ass-planner__badge--mid { background: #fffbeb; color: #b45309; }
.ass-planner__badge--low { background: #fef2f2; color: #991b1b; }
.ass-planner__badge--neutral { background: #f8fafc; color: #475569; }
.ass-planner__link-btn {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: #01256e;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.ass-planner__link-btn:hover { color: #123f91; }

/* Course details overlay — mirrors Schedule Builder "Important Course Details" */
.ass-planner__details {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.ass-planner__details[hidden] { display: none; }
.ass-planner__details-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid #dce2ea;
  background: #fff;
}
.ass-planner__details-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 18px 22px 28px;
  color: #01256e;
}
.ass-planner__details-loading {
  margin: 0;
  color: #51627d;
  font-size: 13px;
}
.ass-planner__sb-instructors {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
}
.ass-planner__sb-inline-label {
  font-weight: 700;
}
.ass-planner__sb-instructors a {
  color: #01256e;
  font-weight: 650;
}
.ass-planner__sb-rmp {
  width: fit-content;
  max-width: min(100%, 280px);
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #ffbf00;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(1, 37, 110, 0.08);
  font-size: 12px;
  color: #64748b;
}
.ass-planner__sb-rmp-head {
  margin: 0 0 8px;
  color: #01256e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.ass-planner__sb-rmp-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ass-planner__sb-rmp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ass-planner__sb-rmp-val {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}
.ass-planner__sb-rmp-val--good { color: #166534; background: #ecfdf5; }
.ass-planner__sb-rmp-val--mid { color: #b45309; background: #fffbeb; }
.ass-planner__sb-rmp-val--low { color: #991b1b; background: #fef2f2; }
.ass-planner__sb-rmp-val--neutral { color: #475569; background: #f8fafc; }
.ass-planner__sb-rmp-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
}
.ass-planner__sb-rmp-footer a {
  color: #01256e;
  font-weight: 600;
  text-decoration: none;
}
.ass-planner__sb-rmp-footer a:hover { text-decoration: underline; }
.ass-planner__sb-rmp-via {
  color: #94a3b8 !important;
  font-size: 10px !important;
  font-weight: 500 !important;
}
.ass-planner__sb-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 22px;
  max-width: 72ch;
}
.ass-planner__sb-field {
  display: grid;
  gap: 4px;
}
.ass-planner__sb-label {
  color: #01256e;
  font-family: Georgia, "Times New Roman", Times, serif;
  font-size: 13px;
  font-weight: 700;
  font-style: italic;
}
.ass-planner__sb-value {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.45;
}
.ass-planner__sb-value a {
  color: #01256e;
  font-weight: 650;
}
.ass-planner__sb-catalog {
  display: inline-block;
  margin-top: 4px;
  color: #01256e;
  font-size: 13px;
  font-weight: 650;
}
.ass-planner__sb-meetings {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ass-planner__sb-meetings td {
  padding: 10px 8px;
  border-top: 1px solid #e5eaf1;
  border-bottom: 1px solid #e5eaf1;
  color: #01256e;
  vertical-align: top;
}
.ass-planner__sb-meetings td:first-child { font-weight: 700; width: 18%; }
.ass-planner__sb-meetings td:nth-child(2) { width: 28%; }
.ass-planner__sb-meetings td:nth-child(3) { width: 10%; font-weight: 700; }

@media (max-width: 860px) {
  .ass-planner__selected,
  .ass-planner__card-body { grid-template-columns: 1fr; }
  .ass-planner__selected-cal,
  .ass-planner__selected-courses { margin: 0 12px 12px; }
  .ass-planner__week { border-right: 0; border-bottom: 1px solid #eef2f7; }
  .ass-planner__week-track { height: 110px; }
}

/* Shared footer bits */
.ass-planner__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
.ass-planner__btn {
  appearance: none;
  padding: 8px 14px;
  border: 1px solid #01256e;
  border-radius: 9px;
  background: #fff;
  color: #01256e;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ass-planner__btn:hover:not(:disabled) { background: #eef4ff; }
.ass-planner__btn--primary { background: #01256e; color: #fff; }
.ass-planner__btn--primary:hover:not(:disabled) { background: #123f91; }
.ass-planner__btn:disabled { opacity: 0.48; cursor: not-allowed; }
.ass-planner__status {
  display: none;
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 9px;
  font-size: 12px;
  line-height: 1.45;
}
.ass-planner__status--info { display: block; background: #eff6ff; color: #1e3a8a; }
.ass-planner__status--error { display: block; background: #fff1f2; color: #9f1239; }
.ass-planner__status--success { display: block; background: #ecfdf3; color: #166534; }
`;
})();
