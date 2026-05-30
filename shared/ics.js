/**
 * Minimal .ics builder for Aggie Schedule Sniper (America/Los_Angeles / PT).
 */
(function (root) {
  const TZID = "America/Los_Angeles";

  const VTIMEZONE = [
    "BEGIN:VTIMEZONE",
    `TZID:${TZID}`,
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  /**
   * Parse registrar / manual quarter dates as Pacific calendar days.
   * @param {string} value e.g. "Sep 23", "Dec 4 @ 11:59 p.m.", "December 4, 2026"
   * @param {number|string} [fallbackYear] from term name when the date omits a year
   * @returns {{ y: number, m: number, d: number } | null} month m is 1–12
   */
  function parseUsDate(value, fallbackYear) {
    let trimmed = (value || "").trim();
    if (!trimmed) {
      return null;
    }

    trimmed = trimmed.replace(/\s*@\s*.+$/i, "").trim();

    let match = trimmed.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
      if (Number.isNaN(month)) {
        return null;
      }
      return { y: Number(match[3]), m: month, d: Number(match[2]) };
    }

    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return { y: Number(match[3]), m: Number(match[1]), d: Number(match[2]) };
    }

    match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (match && fallbackYear) {
      const d = new Date(`${match[1]} ${match[2]}, ${Number(fallbackYear)}`);
      if (!Number.isNaN(d.getTime())) {
        return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
      }
    }

    const ms = Date.parse(trimmed);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms);
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    }

    return null;
  }

  function parseTimeParts(timeStr) {
    const timeMatch = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!timeMatch) {
      return null;
    }
    let hour = Number(timeMatch[1]) % 12;
    if (/pm/i.test(timeMatch[3])) {
      hour += 12;
    }
    return { h: hour, min: Number(timeMatch[2]), s: 0 };
  }

  /** @returns {{ y, m, d, h, min, s } | null} */
  function parseUsDateTime(dateStr, timeStr) {
    const dateMatch = (dateStr || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const time = parseTimeParts(timeStr);
    if (!dateMatch || !time) {
      return null;
    }
    return {
      y: Number(dateMatch[3]),
      m: Number(dateMatch[1]),
      d: Number(dateMatch[2]),
      h: time.h,
      min: time.min,
      s: time.s,
    };
  }

  /** Schedule Builder wall times interpreted as Pacific. */
  function parseTimeOnDate(baseDate, timeStr) {
    const time = parseTimeParts(timeStr);
    if (!time || !baseDate) {
      return null;
    }
    return {
      y: baseDate.y,
      m: baseDate.m,
      d: baseDate.d,
      h: time.h,
      min: time.min,
      s: time.s,
    };
  }

  function weekday(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  }

  function addDays(y, m, d, count) {
    const dt = new Date(Date.UTC(y, m - 1, d + count, 12));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function firstOccurrenceOnOrAfter(baseDate, dayCode) {
    const map = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
    const target = map[dayCode];
    let cursor = { ...baseDate };
    for (let i = 0; i < 7; i += 1) {
      if (weekday(cursor.y, cursor.m, cursor.d) === target) {
        return cursor;
      }
      cursor = addDays(cursor.y, cursor.m, cursor.d, 1);
    }
    return baseDate;
  }

  function endOfPtDay(date) {
    if (!date) {
      return null;
    }
    return { y: date.y, m: date.m, d: date.d, h: 23, min: 59, s: 59 };
  }

  function addHours(parts, hours) {
    const totalMinutes = parts.h * 60 + parts.min + hours * 60;
    const dayOffset = Math.floor(totalMinutes / (24 * 60));
    const remainder = totalMinutes % (24 * 60);
    const nextDay = addDays(parts.y, parts.m, parts.d, dayOffset);
    return {
      y: nextDay.y,
      m: nextDay.m,
      d: nextDay.d,
      h: Math.floor(remainder / 60),
      min: remainder % 60,
      s: parts.s || 0,
    };
  }

  function partsSortKey(parts) {
    return (
      parts.y * 1e10 +
      parts.m * 1e8 +
      parts.d * 1e6 +
      (parts.h || 0) * 1e4 +
      (parts.min || 0)
    );
  }

  function compareParts(a, b) {
    return a.y - b.y || a.m - b.m || a.d - b.d;
  }

  function partsToIso(parts) {
    return `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`;
  }

  function isoToParts(iso) {
    const match = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }

  const MONTH_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function formatPtDateLabel(parts, options = {}) {
    const month = MONTH_SHORT[parts.m - 1] || String(parts.m);
    if (options.includeYear === false) {
      return `${month} ${parts.d}`;
    }
    return `${month} ${parts.d}, ${parts.y}`;
  }

  /** e.g. Sep 23 – Dec 4, 2026 */
  function formatPtDateRange(startParts, endParts) {
    if (!startParts || !endParts) {
      return null;
    }
    if (startParts.y === endParts.y) {
      return `${formatPtDateLabel(startParts, { includeYear: false })} – ${formatPtDateLabel(endParts)}`;
    }
    return `${formatPtDateLabel(startParts)} – ${formatPtDateLabel(endParts)}`;
  }

  function formatIcsUtc(date) {
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      "T",
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
      "Z",
    ].join("");
  }

  function formatIcsPt(parts) {
    return [
      parts.y,
      pad(parts.m),
      pad(parts.d),
      "T",
      pad(parts.h),
      pad(parts.min),
      pad(parts.s || 0),
    ].join("");
  }

  function escapeText(value) {
    return (value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function slugify(value) {
    return (value || "schedule")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  function buildRrule(byDay, untilDate) {
    const parts = [`FREQ=WEEKLY`, `BYDAY=${byDay.join(",")}`];
    const until = endOfPtDay(untilDate);
    if (until) {
      parts.push(`UNTIL=${formatIcsPt(until)}`);
    }
    return parts.join(";");
  }

  function buildIcs(events) {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aggie Schedule Sniper//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...VTIMEZONE,
    ];

    for (const event of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${event.uid}`);
      lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`);
      lines.push(`DTSTART;TZID=${TZID}:${formatIcsPt(event.start)}`);
      lines.push(`DTEND;TZID=${TZID}:${formatIcsPt(event.end)}`);
      lines.push(`SUMMARY:${escapeText(event.summary)}`);
      if (event.location) {
        lines.push(`LOCATION:${escapeText(event.location)}`);
      }
      if (event.description) {
        lines.push(`DESCRIPTION:${escapeText(event.description)}`);
      }
      if (event.rrule) {
        lines.push(`RRULE:${event.rrule}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }

  root.ASS_ICS = {
    TZID,
    buildIcs,
    parseUsDate,
    parseUsDateTime,
    parseTimeOnDate,
    firstOccurrenceOnOrAfter,
    endOfPtDay,
    addHours,
    partsSortKey,
    compareParts,
    partsToIso,
    isoToParts,
    formatPtDateLabel,
    formatPtDateRange,
    slugify,
    buildRrule,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
